import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normaliseFlashcards,
  validateFlashcards,
  FLASHCARDS_SCHEMA_VERSION,
} from "../src/contracts/flashcards";
import { normaliseAnalysis, validateAnalysis, ANALYSIS_SCHEMA_VERSION } from "../src/contracts/analysis";
import { normaliseText, validateText, STUDY_GUIDE_SCHEMA_VERSION } from "../src/contracts/text";

// --- flashcards -------------------------------------------------------------

const flashcardsLower = { flashcards: [{ front: "Was ist Mitose?", back: "Eine Kernteilung." }] };
const flashcardsPascal = { Flashcards: [{ Front: "Was ist Meiose?", Back: "Eine Reifeteilung." }] };
const flashcardsGerman = { Karteikarten: [{ Vorderseite: "Was ist DNS?", "Rückseite": "Erbmolekül." }] };

test("flashcards: lowercase keys normalise", () => {
  const out = normaliseFlashcards(flashcardsLower);
  assert.equal(out.length, 1);
  assert.deepEqual(Object.keys(out[0]).sort(), ["back", "front"]);
  assert.equal(out[0].front, "Was ist Mitose?");
});

test("flashcards: PascalCase keys normalise", () => {
  const out = normaliseFlashcards(flashcardsPascal);
  assert.equal(out[0].front, "Was ist Meiose?");
  assert.equal(out[0].back, "Eine Reifeteilung.");
});

test("flashcards: German umlaut keys normalise", () => {
  const out = normaliseFlashcards(flashcardsGerman);
  assert.equal(out[0].front, "Was ist DNS?");
  assert.equal(out[0].back, "Erbmolekül.");
});

test("flashcards: a non-list payload yields an empty array", () => {
  assert.deepEqual(normaliseFlashcards({ nope: true }), []);
});

test("flashcards: validator accepts a list, rejects an empty back", () => {
  assert.equal(validateFlashcards(normaliseFlashcards(flashcardsLower)).ok, true);
  assert.equal(validateFlashcards([{ front: "x", back: "" }]).ok, false);
  assert.equal(validateFlashcards({ cards: [] }).ok, false);
});

test("flashcards: schema version is a positive integer", () => {
  assert.ok(Number.isInteger(FLASHCARDS_SCHEMA_VERSION) && FLASHCARDS_SCHEMA_VERSION >= 1);
});

// --- analysis ---------------------------------------------------------------

const analysisLower = {
  strengths: ["Zellaufbau verstanden"],
  growthAreas: ["Meiose"],
  topicPerformance: [{ topic: "Zellbiologie", score: 3, total: 4 }],
};
const analysisPascal = {
  Strengths: ["a"],
  GrowthAreas: ["b"],
  TopicPerformance: [{ Topic: "x", Score: 1, Total: 2 }],
};
const analysisGerman = {
  "Stärken": ["a"],
  Lernbereiche: ["b"],
  Themen: [{ Thema: "x", Punkte: 1, Gesamt: 2 }],
};

test("analysis: lowercase keys normalise", () => {
  const out = normaliseAnalysis(analysisLower);
  assert.deepEqual(Object.keys(out).sort(), ["growthAreas", "strengths", "topicPerformance"]);
  assert.deepEqual(out.topicPerformance, [{ topic: "Zellbiologie", score: 3, total: 4 }]);
});

test("analysis: PascalCase keys normalise", () => {
  const out = normaliseAnalysis(analysisPascal);
  assert.deepEqual(out.strengths, ["a"]);
  assert.deepEqual(out.growthAreas, ["b"]);
  assert.deepEqual(out.topicPerformance, [{ topic: "x", score: 1, total: 2 }]);
});

test("analysis: German keys normalise", () => {
  const out = normaliseAnalysis(analysisGerman);
  assert.deepEqual(out.strengths, ["a"]);
  assert.deepEqual(out.growthAreas, ["b"]);
  assert.deepEqual(out.topicPerformance, [{ topic: "x", score: 1, total: 2 }]);
});

test("analysis: numbers given as strings are coerced", () => {
  const out = normaliseAnalysis({ strengths: "one", topicPerformance: [{ topic: "t", score: "2", total: "3" }] });
  assert.deepEqual(out.strengths, ["one"]);
  assert.deepEqual(out.topicPerformance, [{ topic: "t", score: 2, total: 3 }]);
});

test("analysis: validator accepts the contract, rejects a non-object", () => {
  assert.equal(validateAnalysis(normaliseAnalysis(analysisLower)).ok, true);
  assert.equal(validateAnalysis("nope").ok, false);
  assert.equal(validateAnalysis({ strengths: "a" }).ok, false);
});

test("analysis: schema version is a positive integer", () => {
  assert.ok(Number.isInteger(ANALYSIS_SCHEMA_VERSION) && ANALYSIS_SCHEMA_VERSION >= 1);
});

// --- text -------------------------------------------------------------------

test("text: a string becomes the {text} contract", () => {
  assert.deepEqual(normaliseText("## Titel\nInhalt"), { text: "## Titel\nInhalt" });
});

test("text: validator requires a non-empty string", () => {
  assert.equal(validateText({ text: "Inhalt" }).ok, true);
  assert.equal(validateText({ text: "   " }).ok, false);
  assert.equal(validateText({}).ok, false);
  assert.equal(validateText(null).ok, false);
});

test("text: schema version is a positive integer", () => {
  assert.ok(Number.isInteger(STUDY_GUIDE_SCHEMA_VERSION) && STUDY_GUIDE_SCHEMA_VERSION >= 1);
});
