/**
 * Contract: quiz.
 *
 * Structural type the React client reads (`Question` in `src/types.ts`), the
 * tolerant normaliser that maps any model key style onto it, and the strict
 * validator that decides whether the mapped value is usable.
 *
 * Owned here: the option texts carry no `A)` prefix — the UI renders the letter
 * badge itself (`QuizView.tsx`). A `correctIndex` outside the option range means
 * the answer could not be resolved; the validator rejects it, so a quiz that
 * scores every answer wrong can never reach the client.
 *
 * Since 2026-10-08 a question also carries its reasoning surface: `type` names the
 * thinking operation (the module from the prompt) and `optionRationales` holds one
 * justification per option. The option order is randomised, so the rationales are
 * permuted with the options.
 */

import { asText, isRecord, pickKey, type ValidationResult } from "./util";

export interface QuizQuestion {
  id: string;
  /** Thinking operation: WIEDERGEBEN, BEZIEHUNG, AUSSCHLUSS, FOLGERUNG, GRUND/FOLGE, FEHLER … */
  type: string;
  text: string;
  options: string[];
  correctIndex: number;
  /** One justification per option, aligned with `options`. Empty strings are allowed. */
  optionRationales: string[];
  hint: string;
  explanation: string;
  topic: string;
}

export const QUIZ_SCHEMA_VERSION = 3;

/** Bounds for a quiz length. The server clamps every request onto this range.
 *  The ceiling comes from the runtime, not from the subject: the reasoning prompt
 *  costs 128-158 s and 21 000-27 000 output tokens for ten questions, and a repair
 *  pass roughly repeats that. Fifteen questions stay inside `LLM_TIMEOUT_MS`
 *  (600 s); twenty-five do not. */
export const MIN_QUESTIONS = 5;
export const MAX_QUESTIONS = 15;
export const DEFAULT_QUESTIONS = 10;

export function clampQuestionCount(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_QUESTIONS;
  return Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, Math.round(value)));
}

/** Text used to compare two questions: case, punctuation and spacing are dropped. */
export function questionKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// The separator must be followed by a space: "A) Alpha" is a marker, "A-Dur" is a term
// (German music and chemistry write hyphenated terms with a leading capital letter).
const OPTION_PREFIX = /^\s*[A-Ha-h]\s*[).:\-]\s+/;

/** Removes a leading `A)`/`A.`/`A:` marker, unless nothing would remain. */
export function stripOptionPrefix(option: string): string {
  const stripped = option.replace(OPTION_PREFIX, "");
  return stripped.length > 0 ? stripped : option;
}

/** The option shape the prompt asks for: text, correctness flag, own justification. */
interface ParsedOptions {
  options: string[];
  rationales: string[];
  /** Index of the option the model flagged `isCorrect: true`, or -1. */
  flagged: number;
}

const OPTION_TEXT_KEYS = ["text", "option", "answer", "antwort", "optiontext", "label"];
const RATIONALE_KEYS = ["rationale", "begruendung", "begruendungstext", "reason", "why", "warum"];
const CORRECT_KEYS = ["iscorrect", "correct", "richtig", "istrichtig"];

/**
 * Reads the options in either shape: the plain string list of the older contract or
 * the `{text, isCorrect, rationale}` objects the prompt asks for.
 */
function parseOptions(value: unknown): ParsedOptions {
  if (!Array.isArray(value)) return { options: [], rationales: [], flagged: -1 };
  const options: string[] = [];
  const rationales: string[] = [];
  let flagged = -1;

  value.forEach((entry, index) => {
    if (isRecord(entry)) {
      options.push(stripOptionPrefix(asText(pickKey(entry, OPTION_TEXT_KEYS))));
      rationales.push(asText(pickKey(entry, RATIONALE_KEYS)));
      const isCorrect = pickKey(entry, CORRECT_KEYS);
      if (isCorrect === true || isCorrect === "true" || isCorrect === 1) flagged = index;
      return;
    }
    options.push(stripOptionPrefix(asText(entry)));
    rationales.push("");
  });

  return { options, rationales, flagged };
}

const normaliseText = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");

const matchOption = (candidate: string, options: string[]): number => {
  const needle = normaliseText(stripOptionPrefix(candidate));
  if (!needle) return -1;
  return options.findIndex((option) => normaliseText(stripOptionPrefix(option)) === needle);
};

/** Accepts a letter (`B`, `C)`), a letter plus option text, a 1-based number, a 0-based number (0), or the option text. */
export function resolveCorrectIndex(value: unknown, options: string[]): number {
  const length = options.length;
  if (length === 0) return -1;

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value === 0) return 0;
    const index = value - 1;
    return index >= 0 && index < length ? index : -1;
  }

  if (typeof value !== "string") return -1;
  const text = value.trim();
  if (!text) return -1;

  const letterOnly = text.match(/^([A-Ha-h])\s*[).:]?\s*$/);
  if (letterOnly) {
    const index = letterOnly[1].toUpperCase().charCodeAt(0) - 65;
    return index < length ? index : -1;
  }

  if (/^\d+$/.test(text)) return resolveCorrectIndex(Number(text), options);

  const direct = matchOption(text, options);
  if (direct !== -1) return direct;

  const combined = text.match(/^([A-Ha-h])\s*[).:\-]?\s+(.+)$/);
  if (combined) {
    const rest = matchOption(combined[2], options);
    if (rest !== -1) return rest;
    const index = combined[1].toUpperCase().charCodeAt(0) - 65;
    return index < length ? index : -1;
  }

  return -1;
}

/**
 * Shuffles the options of one question and moves `correctIndex` and the per-option
 * rationales with them.
 *
 * The model puts the correct option first far too often (measured on the live
 * deployment: 10 of 10 questions, across three packages). The order is therefore
 * randomised here and the index is re-derived from the permutation, so the answer
 * can never sit in a fixed position.
 */
export function shuffleOptions(question: QuizQuestion, rng: () => number = Math.random): QuizQuestion {
  const { options, correctIndex, optionRationales } = question;
  if (correctIndex < 0 || correctIndex >= options.length || options.length < 2) return question;
  const order = options.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    ...question,
    options: order.map((index) => options[index]),
    optionRationales: order.map((index) => optionRationales[index] ?? ""),
    correctIndex: order.indexOf(correctIndex),
  };
}

/**
 * Maps any model key style onto the contract and randomises the option order.
 * `rng` is injectable so a test can pin the permutation.
 */
export function normaliseQuiz(raw: unknown, rng: () => number = Math.random): QuizQuestion[] {
  const list = Array.isArray(raw) ? raw : pickKey(raw, ["quiz", "questions", "fragen", "items", "mcq"]);
  if (!Array.isArray(list)) return [];
  return list.map((entry, position) => {
    const parsed = parseOptions(
      pickKey(entry, ["options", "answers", "choices", "antworten", "optionen", "answeroptions"]),
    );
    const rawCorrect = pickKey(entry, [
      "correct_answer",
      "correctanswer",
      "correct_index",
      "correctoption",
      "correctoptionindex",
      "correct",
      "answer",
      "antwort",
      "richtige_antwort",
      "richtigeantwort",
      "loesung",
      "loesungindex",
      "loesungsindex",
    ]);
    const correctIndex =
      parsed.flagged >= 0 && parsed.flagged < parsed.options.length
        ? parsed.flagged
        : resolveCorrectIndex(rawCorrect, parsed.options);
    return shuffleOptions(
      {
        id: asText(pickKey(entry, ["id", "uuid"])) || `q${position + 1}`,
        type: asText(pickKey(entry, ["type", "typ", "aufgabentyp", "art", "kategorie", "category"])),
        text: asText(pickKey(entry, ["question", "text", "frage", "title", "prompt", "stem"])),
        options: parsed.options,
        correctIndex,
        optionRationales: parsed.rationales,
        hint: asText(pickKey(entry, ["hint", "hinweis", "tip", "tipp"])),
        explanation: asText(
          pickKey(entry, ["explanation", "explanationtext", "erklaerung", "why", "reason", "begruendung"]),
        ),
        topic: asText(pickKey(entry, ["topic", "thema", "subject", "fach"])),
      },
      rng,
    );
  });
}

export function validateQuiz(value: unknown): ValidationResult<QuizQuestion[]> {
  if (!Array.isArray(value)) return { ok: false, error: "quiz: ein Array mit Fragen wurde erwartet." };
  if (value.length === 0) return { ok: false, error: "quiz: das Quiz enthält keine Fragen." };

  for (let i = 0; i < value.length; i += 1) {
    const question = value[i] as Partial<QuizQuestion> | undefined;
    const label = `quiz: Frage ${i + 1}`;
    if (typeof question !== "object" || question === null) return { ok: false, error: `${label} ist kein Objekt.` };
    if (typeof question.id !== "string" || !question.id) return { ok: false, error: `${label} hat keine id.` };
    if (typeof question.text !== "string" || !question.text.trim()) return { ok: false, error: `${label} hat keinen Fragetext.` };
    if (!Array.isArray(question.options) || question.options.length < 2) {
      return { ok: false, error: `${label} braucht mindestens zwei Antwortoptionen.` };
    }
    if (question.options.some((option) => typeof option !== "string" || option.trim().length === 0)) {
      return { ok: false, error: `${label} hat eine leere Antwortoption.` };
    }
    if (
      !Number.isInteger(question.correctIndex) ||
      (question.correctIndex as number) < 0 ||
      (question.correctIndex as number) >= question.options.length
    ) {
      return { ok: false, error: `${label} hat keine gültige richtige Antwort.` };
    }
    // The rationales may be empty, but they must not shift the mapping: an array of
    // another length would attach a justification to the wrong option.
    if (
      question.optionRationales !== undefined &&
      (!Array.isArray(question.optionRationales) ||
        question.optionRationales.length !== question.options.length)
    ) {
      return { ok: false, error: `${label} hat Begründungen, die nicht zu den Optionen passen.` };
    }
  }

  return { ok: true, value: value as QuizQuestion[] };
}
