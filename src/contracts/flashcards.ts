/**
 * Contract: flashcards.
 *
 * The client reads `{ front, back }` (`FlashcardsView`). The normaliser maps any
 * model key style onto it; the validator rejects cards without both sides.
 */

import { asText, pickKey, type ValidationResult } from "./util";

export interface Flashcard {
  front: string;
  back: string;
}

export const FLASHCARDS_SCHEMA_VERSION = 1;

/** Length of one card round. The server clamps onto this range, like the quiz does. */
export const MIN_CARDS = 5;
export const MAX_CARDS = 15;
export const DEFAULT_CARDS = 10;

/** `0` means "not requested". A number outside the range is pulled onto its nearest end. */
export const clampFlashcardCount = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(MAX_CARDS, Math.max(MIN_CARDS, Math.round(value)));
};

/** Comparison key for a front side: case, punctuation and spacing are dropped. */
export const cardKey = (front: string): string =>
  front
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9äöüß\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Appends new cards and drops a card whose front already exists. */
export function mergeFlashcards(existing: Flashcard[], extra: Flashcard[]): Flashcard[] {
  const seen = new Set(existing.map((card) => cardKey(card.front)));
  const merged = [...existing];
  for (const card of extra) {
    const key = cardKey(card.front);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(card);
  }
  return merged;
}

export function normaliseFlashcards(raw: unknown): Flashcard[] {
  const list = Array.isArray(raw) ? raw : pickKey(raw, ["flashcards", "cards", "karten", "karteikarten"]);
  if (!Array.isArray(list)) return [];
  return list.map((entry) => ({
    front: asText(pickKey(entry, ["front", "question", "frage", "vorderseite", "term", "begriff"])),
    back: asText(pickKey(entry, ["back", "answer", "antwort", "rueckseite", "definition", "explanation"])),
  }));
}

export function validateFlashcards(value: unknown): ValidationResult<Flashcard[]> {
  if (!Array.isArray(value)) return { ok: false, error: "flashcards: ein Array mit Karten wurde erwartet." };
  if (value.length === 0) return { ok: false, error: "flashcards: es wurden keine Karten erzeugt." };

  for (let i = 0; i < value.length; i += 1) {
    const card = value[i] as Partial<Flashcard> | undefined;
    const label = `flashcards: Karte ${i + 1}`;
    if (typeof card !== "object" || card === null) return { ok: false, error: `${label} ist kein Objekt.` };
    if (typeof card.front !== "string" || !card.front.trim()) return { ok: false, error: `${label} hat keine Vorderseite.` };
    if (typeof card.back !== "string" || !card.back.trim()) return { ok: false, error: `${label} hat keine Rückseite.` };
  }

  return { ok: true, value: value as Flashcard[] };
}
