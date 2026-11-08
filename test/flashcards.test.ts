/**
 * Card rounds: the requested length, and the append that must not repeat a front.
 *
 * The view lets the user add 5, 10 or 15 cards while the round runs, so the set grows and the
 * prompt must know which fronts already exist. A duplicate front means the same card twice in one
 * round — the merge drops it, the prompt asks for other passages.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { clampFlashcardCount, mergeFlashcards, cardKey, MIN_CARDS, MAX_CARDS } from "../src/contracts/flashcards";
import { buildPrompt } from "../src/ai/prompts";

test("no requested count means no request", () => {
  assert.equal(clampFlashcardCount(Number(undefined)), 0);
  assert.equal(clampFlashcardCount(0), 0);
  assert.equal(clampFlashcardCount(-3), 0);
  assert.equal(clampFlashcardCount(Number.NaN), 0);
});

test("a count stays inside the card range", () => {
  assert.equal(clampFlashcardCount(3), MIN_CARDS);
  assert.equal(clampFlashcardCount(10), 10);
  assert.equal(clampFlashcardCount(99), MAX_CARDS);
});

test("an append keeps the old cards and drops a repeated front", () => {
  const existing = [{ front: "Wo liegt Paris?", back: "In Frankreich." }];
  const extra = [
    { front: "wo liegt paris", back: "Frankreich" },
    { front: "Wie heißt der Fluss durch Paris?", back: "Die Seine." },
  ];
  const merged = mergeFlashcards(existing, extra);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged[0], existing[0]);
  assert.equal(merged[1].back, "Die Seine.");
});

test("two fronts that only differ in punctuation are one card", () => {
  assert.equal(cardKey("Wer war Napoleon?"), cardKey("wer war napoleon"));
});

test("the card prompt carries the count and the existing fronts", () => {
  const spec = buildPrompt("flashcards", {
    content: "Photosynthese: Chloroplasten, Licht, Wasser, CO2 -> Glukose, O2.",
    grade: 5,
    count: 5,
    exclude: ["Wo liegt Paris?"],
  });
  assert.equal(spec.isJson, true);
  assert.match(spec.prompt, /Erstelle 5 Karteikarten/);
  assert.match(spec.prompt, /Diese Vorderseiten gibt es schon/);
  assert.match(spec.prompt, /- Wo liegt Paris\?/);
  assert.match(spec.prompt, /json/i);
});

test("a fresh round names no existing fronts", () => {
  const spec = buildPrompt("flashcards", { content: "Material", grade: 5 });
  assert.match(spec.prompt, /Erstelle 10 Karteikarten/);
  assert.equal(spec.prompt.includes("Diese Vorderseiten gibt es schon"), false);
});
