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
import { buildPrompt, OUTPUT_CONTRACT, type ArtifactKind, type PromptSpec } from "./prompts";
import { normaliseQuiz, validateQuiz, type QuizQuestion } from "../contracts/quiz";
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
}

export interface GatewayError {
  code: string;
  message: string;
}

export type GatewayResult<T> =
  | { ok: true; value: T; error?: null; repaired: boolean }
  | { ok: false; value?: null; error: GatewayError; repaired?: false };

interface ContractSpec<T> {
  structured: boolean;
  normalise: (raw: unknown) => T;
  validate: (value: unknown) => ValidationResult<T>;
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

  const call = (prompt: string): Promise<string> =>
    callModel({
      ...config,
      prompt,
      isJson: spec.isJson,
      useFlashModel: spec.useFlashModel,
      imageData: spec.imageData,
    });

  let firstRaw: string;
  try {
    firstRaw = await call(spec.prompt);
  } catch (error) {
    return { ok: false, error: { code: "AI_PROVIDER", message: humanReadable(error) } };
  }

  const first = toContract(contract, firstRaw);
  if (first.ok) return { ok: true, value: first.value, repaired: false };

  // One repair retry with the validation error.
  const repairPrompt = `${spec.prompt}\n\nDeine letzte Antwort war ungültig: ${first.error}\nAntworte erneut und halte den Ausgabe-Vertrag exakt ein:\n${OUTPUT_CONTRACT[kind]}`;
  let secondRaw: string;
  try {
    secondRaw = await call(repairPrompt);
  } catch (error) {
    return { ok: false, error: { code: "AI_PROVIDER", message: humanReadable(error) } };
  }

  const second = toContract(contract, secondRaw);
  if (second.ok) return { ok: true, value: second.value, repaired: true };

  return {
    ok: false,
    error: {
      code: "AI_INVALID",
      message: `Die Antwort des Modells erfüllt den Vertrag auch nach einer Korrektur nicht: ${second.error}`,
    },
  };
}
