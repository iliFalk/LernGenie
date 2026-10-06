import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normaliseQuiz,
  validateQuiz,
  resolveCorrectIndex,
  QUIZ_SCHEMA_VERSION,
} from "../src/contracts/quiz";

const keysOf = (value: object): string[] => Object.keys(value).sort();

// --- Captured model answers (task t_b1be270f, section "Ist") -----------------

// PascalCase keys, options with an `A)` prefix, the answer as "C) <text>".
const pascalCase = {
  Quiz: [
    {
      Question: "Welches Organell enthält die Erbinformation?",
      Options: ["A) Zellmembran", "B) Ribosom", "C) Zellkern", "D) Mitochondrium"],
      CorrectAnswer: "C) Zellkern",
      Hint: "Denke an den Ort der DNA.",
      Explanation: "Die DNA liegt im Zellkern.",
      Topic: "Zellbiologie",
    },
  ],
};

// Lowercase keys, options without a prefix, the answer as a letter.
const lowercase = {
  quiz: [
    {
      question: "Wie teilt sich eine Körperzelle?",
      options: ["Mitose", "Meiose"],
      correct_answer: "A",
      hint: "Keimzellen sind anders.",
      explanation: "Körperzellen teilen sich durch Mitose.",
      topic: "Zellteilung",
    },
  ],
};

// German keys.
const german = {
  quiz: [
    {
      Frage: "Wie heißt die kleinste lebende Einheit?",
      Optionen: ["Zelle", "Atom"],
      RichtigeAntwort: "A",
      Hinweis: "Sie ist der Baustein aller Lebewesen.",
      Erklärung: "Die Zelle ist die kleinste lebende Einheit.",
      Thema: "Biologie",
    },
  ],
};

// German keys with "Antworten" (options) and "Antwort" (the answer).
const germanAnswer = {
  quiz: [
    {
      Frage: "Wie viele Chromosomen hat der Mensch?",
      Antworten: ["46", "23"],
      Antwort: "A",
    },
  ],
};

// The model omitted the correct answer entirely — the bug that scored every
// answer wrong. The normaliser still produces the contract shape (index -1);
// the validator is what rejects it.
const missingAnswer = {
  quiz: [
    {
      question: "Was ist Osmose?",
      options: ["Diffusion durch eine Membran", "Aktiver Transport"],
      hint: "",
      explanation: "",
      topic: "",
    },
  ],
};

// --- normaliseQuiz ----------------------------------------------------------

test("PascalCase keys normalise to the contract array", () => {
  const out = normaliseQuiz(pascalCase);
  assert.ok(Array.isArray(out), "expected an array");
  assert.equal(out.length, 1);
  const q = out[0];
  assert.deepEqual(keysOf(q), [
    "correctIndex",
    "explanation",
    "hint",
    "id",
    "options",
    "text",
    "topic",
  ]);
  assert.equal(q.text, "Welches Organell enthält die Erbinformation?");
  assert.deepEqual(q.options, ["Zellmembran", "Ribosom", "Zellkern", "Mitochondrium"]);
  assert.equal(q.correctIndex, 2);
  assert.equal(q.topic, "Zellbiologie");
  assert.equal(q.hint, "Denke an den Ort der DNA.");
  assert.equal(q.explanation, "Die DNA liegt im Zellkern.");
});

test("lowercase contract keys pass through", () => {
  const q = normaliseQuiz(lowercase)[0];
  assert.deepEqual(q.options, ["Mitose", "Meiose"]);
  assert.equal(q.correctIndex, 0);
});

test("German keys normalise to the contract shape", () => {
  const q = normaliseQuiz(german)[0];
  assert.equal(q.text, "Wie heißt die kleinste lebende Einheit?");
  assert.deepEqual(q.options, ["Zelle", "Atom"]);
  assert.equal(q.correctIndex, 0);
  assert.equal(q.topic, "Biologie");
});

test("German 'Antworten'/'Antwort' keys split options from the answer", () => {
  const q = normaliseQuiz(germanAnswer)[0];
  assert.deepEqual(q.options, ["46", "23"]);
  assert.equal(q.correctIndex, 0);
});

test("a question without an answer key keeps index -1", () => {
  const q = normaliseQuiz(missingAnswer)[0];
  assert.equal(q.correctIndex, -1);
});

test("an object that is not a list yields an empty array", () => {
  assert.deepEqual(normaliseQuiz({ foo: "bar" }), []);
  assert.deepEqual(normaliseQuiz(null), []);
});

test("options with and without a letter prefix both become bare texts", () => {
  const withPrefix = normaliseQuiz({ quiz: [{ question: "x", options: ["A) Alpha", "B) Beta"], correct_answer: "B" }] })[0];
  assert.deepEqual(withPrefix.options, ["Alpha", "Beta"]);
  const withoutPrefix = normaliseQuiz({ quiz: [{ question: "x", options: ["Alpha", "Beta"], correct_answer: "B" }] })[0];
  assert.deepEqual(withoutPrefix.options, ["Alpha", "Beta"]);
  assert.equal(withPrefix.correctIndex, withoutPrefix.correctIndex);
});

// --- resolveCorrectIndex ----------------------------------------------------

const FOUR = ["Alpha", "Beta", "Gamma", "Delta"];

test("resolveCorrectIndex reads a letter", () => {
  assert.equal(resolveCorrectIndex("B", FOUR), 1);
  assert.equal(resolveCorrectIndex("b)", FOUR), 1);
  assert.equal(resolveCorrectIndex("C", FOUR), 2);
});

test("resolveCorrectIndex reads a letter plus option text", () => {
  assert.equal(resolveCorrectIndex("B) Beta", ["A) Alpha", "B) Beta", "C) Gamma"]), 1);
});

test("resolveCorrectIndex reads a 1-based number", () => {
  assert.equal(resolveCorrectIndex(1, FOUR), 0);
  assert.equal(resolveCorrectIndex(4, FOUR), 3);
});

test("resolveCorrectIndex reads a 0-based number", () => {
  assert.equal(resolveCorrectIndex(0, FOUR), 0);
  assert.equal(resolveCorrectIndex("0", FOUR), 0);
});

test("resolveCorrectIndex reads the option text", () => {
  assert.equal(resolveCorrectIndex("Gamma", FOUR), 2);
  assert.equal(resolveCorrectIndex("gamma", FOUR), 2);
});

test("resolveCorrectIndex returns -1 when nothing matches", () => {
  assert.equal(resolveCorrectIndex("Z", FOUR), -1);
  assert.equal(resolveCorrectIndex("", FOUR), -1);
  assert.equal(resolveCorrectIndex(9, FOUR), -1);
  assert.equal(resolveCorrectIndex("E", FOUR), -1);
});

// --- validateQuiz -----------------------------------------------------------

test("validateQuiz accepts a well-formed quiz", () => {
  const result = validateQuiz(normaliseQuiz(pascalCase));
  assert.equal(result.ok, true);
});

test("validateQuiz rejects a missing correct answer", () => {
  const result = validateQuiz(normaliseQuiz(missingAnswer));
  assert.equal(result.ok, false);
});

test("validateQuiz rejects a non-array payload", () => {
  assert.equal(validateQuiz({ quiz: [] }).ok, false);
  assert.equal(validateQuiz(null).ok, false);
});

test("validateQuiz rejects a question with fewer than two options", () => {
  const result = validateQuiz([
    { id: "q1", text: "x", options: ["only"], correctIndex: 0, hint: "", explanation: "", topic: "" },
  ]);
  assert.equal(result.ok, false);
});

test("validateQuiz rejects an out-of-range correctIndex", () => {
  const result = validateQuiz([
    { id: "q1", text: "x", options: ["a", "b"], correctIndex: 5, hint: "", explanation: "", topic: "" },
  ]);
  assert.equal(result.ok, false);
});

test("schema version is a positive integer", () => {
  assert.ok(Number.isInteger(QUIZ_SCHEMA_VERSION) && QUIZ_SCHEMA_VERSION >= 1);
});
