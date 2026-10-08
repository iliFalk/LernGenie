/**
 * The single AI entry point.
 *
 * `generateArtifact(kind, input, config, deps)`:
 *   build the request (data + output contract) -> call the provider -> extract
 *   JSON from the answer -> normalise onto the contract -> validate -> on
 *   failure one repair retry with the validation error -> a typed result or a
 *   typed error.
 *
 * The provider call is injected (`deps.callModel`) so tests run without a
 * network. A model answer that fails its contract twice never becomes a value —
 * the route turns the typed error into `{error, code}` with HTTP 500.
 */

import { callLLM } from "../../llm";
import { extractJson } from "./extract";
import { buildPrompt, OUTPUT_CONTRACT, quizRepairPrompt, type ArtifactKind, type PromptSpec } from "./prompts";
import { checkQuiz, formatQuizFlags, type QuizCheckResult } from "./quizCheck";
import { normaliseQuiz, validateQuiz, questionKey, type QuizQuestion } from "../contracts/quiz";
import { normaliseFlashcards, validateFlashcards, type Flashcard } from "../contracts/flashcards";
import { normaliseAnalysis, validateAnalysis, type AnalysisData } from "../contracts/analysis";
import { normaliseText, validateText, type TextArtifact } from "../contracts/text";
import type { ValidationResult } from "../contracts/util";

export interface ModelConfig {
  provider: string;
  apiKey?: string;
  model?: string;
}

export interface ModelCallParams extends ModelConfig {
  prompt: string;
  isJson?: boolean;
  useFlashModel?: boolean;
  imageData?: { data: string; mimeType: string };
}

export interface GatewayDeps {
  callModel: (params: ModelCallParams) => Promise<string>;
  /** The mechanical quality checks; injectable so a test can pin when the pass fires. */
  check?: (quiz: QuizQuestion[], options: { source: string }) => QuizCheckResult;
}

export interface GatewayError {
  code: string;
  message: string;
}

export type GatewayResult<T> =
  | { ok: true; value: T; error?: null; repaired: boolean; flags?: string[] }
  | { ok: false; value?: null; error: GatewayError; repaired?: false; flags?: string[] };

interface ContractSpec<T> {
  structured: boolean;
  normalise: (raw: unknown) => T;
  validate: (value: unknown) => ValidationResult<T>;
}

/**
 * Keeps the first `target` questions that are new: a question whose text already
 * appeared in `previous` (the set the user just solved) or earlier in this batch
 * is dropped. The prompt asks for a surplus, so the trim usually still yields
 * `target` questions. If too few remain, the dropped ones top the list up — a
 * short quiz is worse than a repeated question.
 */
export function selectQuestions(questions: QuizQuestion[], target: number, previous: string[]): QuizQuestion[] {
  const seen = new Set(previous.map(questionKey).filter(Boolean));
  const kept: QuizQuestion[] = [];
  const rest: QuizQuestion[] = [];

  for (const question of questions) {
    const key = questionKey(question.text);
    if (!key || seen.has(key)) {
      rest.push(question);
      continue;
    }
    seen.add(key);
    kept.push(question);
  }

  for (const question of rest) {
    if (kept.length >= target) break;
    kept.push(question);
  }

  return kept.slice(0, target);
}

const CONTRACTS: {
  quiz: ContractSpec<QuizQuestion[]>;
  flashcards: ContractSpec<Flashcard[]>;
  analysis: ContractSpec<AnalysisData>;
  text: ContractSpec<TextArtifact>;
} = {
  quiz: { structured: true, normalise: normaliseQuiz, validate: validateQuiz },
  flashcards: { structured: true, normalise: normaliseFlashcards, validate: validateFlashcards },
  analysis: { structured: true, normalise: normaliseAnalysis, validate: validateAnalysis },
  text: { structured: false, normalise: normaliseText, validate: validateText },
};

/** Reads a human-readable message out of a provider error, unwrapping a JSON error body if present. */
function humanReadable(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const start = message.indexOf("{");
  if (start !== -1) {
    try {
      const parsed = JSON.parse(message.slice(start));
      if (parsed?.error?.message) return String(parsed.error.message);
      if (parsed?.message) return String(parsed.message);
    } catch {
      // keep the raw message
    }
  }
  return message;
}

function toContract<T>(
  spec: ContractSpec<T>,
  raw: string,
): { ok: true; value: T; error?: null } | { ok: false; value?: null; error: string } {
  if (spec.structured) {
    const extracted = extractJson(raw);
    if (!extracted.ok) return { ok: false, error: extracted.error };
    return spec.validate(spec.normalise(extracted.value));
  }
  return spec.validate(spec.normalise(raw));
}

const defaultDeps: GatewayDeps = {
  callModel: (params) => callLLM(params),
};

export async function generateArtifact<T = unknown>(
  kind: ArtifactKind,
  input: Record<string, unknown>,
  config: ModelConfig,
  deps: Partial<GatewayDeps> = {},
): Promise<GatewayResult<T>> {
  const spec: PromptSpec = buildPrompt(kind, input);
  const contract = CONTRACTS[kind] as unknown as ContractSpec<T>;
  const callModel = deps.callModel ?? defaultDeps.callModel;
  const qualityCheck = deps.check ?? checkQuiz;
  const previous = Array.isArray(input.previous) ? input.previous.map(String).filter(Boolean) : [];

  /** A quiz answer is trimmed to its target length and freed of repeats. */
  const finalise = (value: T): T => {
    if (kind !== "quiz" || !spec.targetCount) return value;
    return selectQuestions(value as unknown as QuizQuestion[], spec.targetCount, previous) as unknown as T;
  };

  const call = (prompt: string): Promise<string> =>
    callModel({
      ...config,
      prompt,
      isJson: spec.isJson,
      useFlashModel: spec.useFlashModel,
      imageData: spec.imageData,
    });

  /**
   * Quality pass for a quiz. The mechanical checks catch what the prompt only asked
   * for — a correct option that is the longest, negation options, options that do
   * not exist in the material, missing justifications. One repair call rewrites the
   * flagged questions; the version with fewer findings wins.
   */
  const qualityRepair = async (value: T): Promise<{ value: T; repaired: boolean; flags: string[] }> => {
    if (kind !== "quiz") return { value, repaired: false, flags: [] };
    const source = String(input.content ?? "");
    const before = qualityCheck(value as unknown as QuizQuestion[], { source });
    const total = (value as unknown as QuizQuestion[]).length;
    if (before.flagged === 0 && before.global.length === 0) {
      console.log(`[quiz] Qualitätsprüfung: ${total} Fragen, keine Beanstandungen`);
      return { value, repaired: false, flags: [] };
    }
    console.log(
      `[quiz] Qualitätsprüfung: ${before.flagged}/${total} Fragen beanstandet, ${before.global.length} Befund(e) zum Set`,
    );

    const flags = formatQuizFlags(value as unknown as QuizQuestion[], before);
    const prompt = quizRepairPrompt(value, flags, source, Number(input.grade) || 0);
    let raw: string;
    try {
      raw = await call(prompt);
    } catch {
      return { value, repaired: false, flags: flags.split("\n") };
    }
    const candidate = toContract(contract, raw);
    if (!candidate.ok) return { value, repaired: false, flags: flags.split("\n") };

    const repairedValue = finalise(candidate.value);
    const after = qualityCheck(repairedValue as unknown as QuizQuestion[], { source });
    const better =
      after.flagged + after.global.length < before.flagged + before.global.length;
    return better
      ? { value: repairedValue, repaired: true, flags: [...formatQuizFlags(repairedValue as unknown as QuizQuestion[], after).split("\n")] }
      : { value, repaired: false, flags: flags.split("\n") };
  };

  let firstRaw: string;
  try {
    firstRaw = await call(spec.prompt);
  } catch (error) {
    return { ok: false, error: { code: "AI_PROVIDER", message: humanReadable(error) } };
  }

  const first = toContract(contract, firstRaw);
  if (first.ok) {
    const checked = await qualityRepair(finalise(first.value));
    return { ok: true, value: checked.value, repaired: false, flags: checked.flags };
  }

  // One repair retry with the validation error.
  const repairPrompt = `${spec.prompt}\n\nDeine letzte Antwort war ungültig: ${first.error}\nAntworte erneut und halte den Ausgabe-Vertrag exakt ein:\n${OUTPUT_CONTRACT[kind]}`;
  let secondRaw: string;
  try {
    secondRaw = await call(repairPrompt);
  } catch (error) {
    return { ok: false, error: { code: "AI_PROVIDER", message: humanReadable(error) } };
  }

  const second = toContract(contract, secondRaw);
  if (second.ok) {
    const checked = await qualityRepair(finalise(second.value));
    return { ok: true, value: checked.value, repaired: true, flags: checked.flags };
  }

  return {
    ok: false,
    error: {
      code: "AI_INVALID",
      message: `Die Antwort des Modells erfüllt den Vertrag auch nach einer Korrektur nicht: ${second.error}`,
    },
  };
}
