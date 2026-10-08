/**
 * The shape a route returns must equal the contract the client reads.
 *
 * This test compares the normaliser output against the client types in
 * `src/types.ts` — at runtime for the key sets, and at compile time (checked by
 * `tsc --noEmit`) for assignability.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Question, AnalysisData } from "../src/types";
import { normaliseQuiz } from "../src/contracts/quiz";
import { normaliseFlashcards } from "../src/contracts/flashcards";
import { normaliseAnalysis } from "../src/contracts/analysis";

const quizSample = {
  quiz: [{ question: "x", options: ["a", "b"], correct_answer: "A", hint: "h", explanation: "e", topic: "t" }],
};

test("a normalised quiz item has exactly the Question keys", () => {
  const question: Question = normaliseQuiz(quizSample)[0];
  assert.deepEqual(Object.keys(question).sort(), [
    "correctIndex",
    "explanation",
    "hint",
    "id",
    "optionRationales",
    "options",
    "text",
    "topic",
    "type",
  ]);
});

test("a normalised flashcard has exactly the client keys", () => {
  const card = normaliseFlashcards({ flashcards: [{ front: "f", back: "b" }] })[0];
  assert.deepEqual(Object.keys(card).sort(), ["back", "front"]);
});

test("a normalised analysis has exactly the AnalysisData keys", () => {
  const analysis: AnalysisData = normaliseAnalysis({
    strengths: ["s"],
    growthAreas: ["g"],
    topicPerformance: [{ topic: "t", score: 1, total: 2 }],
  });
  assert.deepEqual(Object.keys(analysis).sort(), ["growthAreas", "strengths", "topicPerformance"]);
  assert.deepEqual(Object.keys(analysis.topicPerformance[0]).sort(), ["score", "topic", "total"]);
});
