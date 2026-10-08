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
 */

import { asStringArray, asText, pickKey, type ValidationResult } from "./util";

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  hint: string;
  explanation: string;
  topic: string;
}

export const QUIZ_SCHEMA_VERSION = 2;

/** Bounds for a quiz length. The server clamps every request onto this range.
 *  The ceiling comes from the output budget: one question costs roughly 130 output
 *  tokens, `LLM_MAX_TOKENS` is 8192 and the model spends a few thousand reasoning
 *  tokens first. Measured with a larger ceiling: 30 questions asked in one answer
 *  run past the limit, the JSON is cut and the call fails with AI_INVALID. */
export const MIN_QUESTIONS = 5;
export const MAX_QUESTIONS = 25;
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

/**
 * Shuffles the options of one question and moves `correctIndex` with them.
 *
 * The model puts the correct option first far too often (measured on the live
 * deployment: 10 of 10 questions, across three packages). The order is therefore
 * randomised here and the index is re-derived from the permutation, so the
 * answer can never sit in a fixed position.
 */
export function shuffleOptions(question: QuizQuestion, rng: () => number = Math.random): QuizQuestion {
  const { options, correctIndex } = question;
  if (correctIndex < 0 || correctIndex >= options.length || options.length < 2) return question;
  const order = options.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    ...question,
    options: order.map((index) => options[index]),
    correctIndex: order.indexOf(correctIndex),
  };
}

const OPTION_PREFIX = /^\s*[A-Ha-h]\s*[).:\-]\s*/;

/** Removes a leading `A)`/`A.`/`A:` marker, unless nothing would remain. */
export function stripOptionPrefix(option: string): string {
  const stripped = option.replace(OPTION_PREFIX, "");
  return stripped.length > 0 ? stripped : option;
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
 * Maps any model key style onto the contract and randomises the option order.
 * `rng` is injectable so a test can pin the permutation.
 */
export function normaliseQuiz(raw: unknown, rng: () => number = Math.random): QuizQuestion[] {
  const list = Array.isArray(raw) ? raw : pickKey(raw, ["quiz", "questions", "fragen", "items", "mcq"]);
  if (!Array.isArray(list)) return [];
  return list.map((entry, position) => {
    const options = asStringArray(
      pickKey(entry, ["options", "answers", "choices", "antworten", "optionen"]),
    ).map(stripOptionPrefix);
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
    return shuffleOptions(
      {
        id: asText(pickKey(entry, ["id", "uuid"])) || `q${position + 1}`,
        text: asText(pickKey(entry, ["question", "text", "frage", "title", "prompt"])),
        options,
        correctIndex: resolveCorrectIndex(rawCorrect, options),
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
  }

  return { ok: true, value: value as QuizQuestion[] };
}
