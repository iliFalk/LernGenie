import { test } from "node:test";
import assert from "node:assert/strict";

import { generateArtifact, type ModelCallParams } from "../src/ai/gateway";
import type { QuizQuestion } from "../src/contracts/quiz";
import type { TextArtifact } from "../src/contracts/text";
import type { Flashcard } from "../src/contracts/flashcards";
import type { AnalysisData } from "../src/contracts/analysis";

const config = { provider: "gemini", apiKey: "test-key" };
const quizInput = { content: "Zellen", grade: 5, count: 1 };

const goodQuiz = JSON.stringify({
  quiz: [{ question: "Wie teilt sich eine Körperzelle?", options: ["Mitose", "Meiose"], correct_answer: "A", hint: "h", explanation: "e", topic: "t" }],
});

const makeStub = (responses: string[]): { callModel: (p: ModelCallParams) => Promise<string>; calls: () => number } => {
  let count = 0;
  return {
    calls: () => count,
    callModel: async () => {
      const value = responses[Math.min(count, responses.length - 1)];
      count += 1;
      return value;
    },
  };
};

test("a good answer passes with one provider call", async () => {
  const stub = makeStub([goodQuiz]);
  const result = await generateArtifact<QuizQuestion[]>("quiz", quizInput, config, stub);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.repaired, false);
    assert.equal(result.value.length, 1);
    assert.equal(result.value[0].correctIndex, 0);
  }
  assert.equal(stub.calls(), 1);
});

test("a broken answer triggers exactly one repair and then passes", async () => {
  const stub = makeStub(["kein JSON, nur Text", goodQuiz]);
  const result = await generateArtifact<QuizQuestion[]>("quiz", quizInput, config, stub);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.repaired, true);
  assert.equal(stub.calls(), 2);
});

test("a second bad answer yields a typed error after two calls", async () => {
  const stub = makeStub(["kaputt", "immer noch kaputt"]);
  const result = await generateArtifact<QuizQuestion[]>("quiz", quizInput, config, stub);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "AI_INVALID");
  assert.equal(stub.calls(), 2);
});

test("a quiz without a correct answer triggers the repair", async () => {
  const noAnswer = JSON.stringify({ quiz: [{ question: "q", options: ["a", "b"] }] });
  const stub = makeStub([noAnswer, goodQuiz]);
  const result = await generateArtifact<QuizQuestion[]>("quiz", quizInput, config, stub);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.repaired, true);
  assert.equal(stub.calls(), 2);
});

test("a fenced quiz answer wrapped in prose reaches the contract shape", async () => {
  const fenced = "Hier ist das Quiz:\n```json\n" + goodQuiz + "\n```\nViel Erfolg!";
  const stub = makeStub([fenced]);
  const result = await generateArtifact<QuizQuestion[]>("quiz", quizInput, config, stub);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value[0].options[0], "Mitose");
});

test("a provider error yields a typed error", async () => {
  const result = await generateArtifact<QuizQuestion[]>("quiz", quizInput, config, {
    callModel: async () => {
      throw new Error("boom");
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "AI_PROVIDER");
    assert.equal(result.error.message, "boom");
  }
});

test("text kind wraps a prose answer in {text}", async () => {
  const stub = makeStub(["## Study Guide\nInhalt"]);
  const result = await generateArtifact<TextArtifact>("text", { variant: "study-guide", content: "c" }, config, stub);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value, { text: "## Study Guide\nInhalt" });
});

test("an empty text answer triggers the repair then errors", async () => {
  const stub = makeStub(["   ", ""]);
  const result = await generateArtifact<TextArtifact>("text", { variant: "study-guide", content: "c" }, config, stub);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "AI_INVALID");
  assert.equal(stub.calls(), 2);
});

test("flashcards produce the contract", async () => {
  const stub = makeStub([JSON.stringify({ flashcards: [{ front: "f", back: "b" }] })]);
  const result = await generateArtifact<Flashcard[]>("flashcards", { content: "c" }, config, stub);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value, [{ front: "f", back: "b" }]);
});

test("analysis produces the contract", async () => {
  const stub = makeStub([JSON.stringify({ strengths: ["s"], growthAreas: [], topicPerformance: [{ topic: "t", score: 1, total: 2 }] })]);
  const result = await generateArtifact<AnalysisData>("analysis", { history: [] }, config, stub);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value.topicPerformance, [{ topic: "t", score: 1, total: 2 }]);
});

test("the repair prompt carries the validation error back to the model", async () => {
  let secondPrompt = "";
  let count = 0;
  const result = await generateArtifact<QuizQuestion[]>("quiz", quizInput, config, {
    callModel: async (params) => {
      count += 1;
      if (count === 1) return "kein JSON";
      secondPrompt = params.prompt;
      return goodQuiz;
    },
  });
  assert.equal(result.ok, true);
  assert.match(secondPrompt, /ungültig/i);
});
