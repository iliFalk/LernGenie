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
