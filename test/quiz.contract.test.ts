import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normaliseQuiz,
  validateQuiz,
  resolveCorrectIndex,
  clampQuestionCount,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
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
// The normaliser randomises the option order, so a test compares the option SET
// and the option the index points at — never a position.

const sortedOptions = (options: string[]): string[] => [...options].sort();
const correctOption = (q: { options: string[]; correctIndex: number }): string => q.options[q.correctIndex];

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
    "optionRationales",
    "options",
    "text",
    "topic",
    "type",
  ]);
  assert.equal(q.text, "Welches Organell enthält die Erbinformation?");
  assert.deepEqual(sortedOptions(q.options), ["Mitochondrium", "Ribosom", "Zellkern", "Zellmembran"]);
  assert.equal(correctOption(q), "Zellkern");
  assert.equal(q.topic, "Zellbiologie");
  assert.equal(q.hint, "Denke an den Ort der DNA.");
  assert.equal(q.explanation, "Die DNA liegt im Zellkern.");
});

test("lowercase contract keys pass through", () => {
  const q = normaliseQuiz(lowercase)[0];
  assert.deepEqual(sortedOptions(q.options), ["Meiose", "Mitose"]);
  assert.equal(correctOption(q), "Mitose");
});

test("German keys normalise to the contract shape", () => {
  const q = normaliseQuiz(german)[0];
  assert.equal(q.text, "Wie heißt die kleinste lebende Einheit?");
  assert.deepEqual(sortedOptions(q.options), ["Atom", "Zelle"]);
  assert.equal(correctOption(q), "Zelle");
  assert.equal(q.topic, "Biologie");
});

test("German 'Antworten'/'Antwort' keys split options from the answer", () => {
  const q = normaliseQuiz(germanAnswer)[0];
  assert.deepEqual(sortedOptions(q.options), ["23", "46"]);
  assert.equal(correctOption(q), "46");
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
  assert.deepEqual(sortedOptions(withPrefix.options), ["Alpha", "Beta"]);
  assert.equal(correctOption(withPrefix), "Beta");
  const withoutPrefix = normaliseQuiz({ quiz: [{ question: "x", options: ["Alpha", "Beta"], correct_answer: "B" }] })[0];
  assert.deepEqual(sortedOptions(withoutPrefix.options), ["Alpha", "Beta"]);
  assert.equal(correctOption(withoutPrefix), "Beta");
});

// --- option order -----------------------------------------------------------

const FOUR = ["Alpha", "Beta", "Gamma", "Delta"];

test("the correct answer is not always the first option", () => {
  const raw = { quiz: [{ question: "x", options: FOUR, correct_answer: "A" }] };
  const positions = new Set<number>();
  for (let i = 0; i < 200; i += 1) {
    const q = normaliseQuiz(raw)[0];
    assert.equal(correctOption(q), "Alpha", "the shuffle must carry the index with the option");
    assert.deepEqual(sortedOptions(q.options), [...FOUR].sort(), "no option may be lost or added");
    positions.add(q.correctIndex);
  }
  assert.deepEqual([...positions].sort(), [0, 1, 2, 3], "all four positions must occur");
});

test("the shuffle is reproducible with an injected rng", () => {
  // A fixed stream of rng values pins the permutation, so the test is exact.
  const raw = { quiz: [{ question: "x", options: FOUR, correct_answer: "C" }] };
  const first = normaliseQuiz(raw, () => 0)[0];
  const second = normaliseQuiz(raw, () => 0)[0];
  assert.deepEqual(first, second);
  assert.equal(correctOption(first), "Gamma");
});

test("a single-option question is left untouched", () => {
  const q = normaliseQuiz({ quiz: [{ question: "x", options: ["nur eine"], correct_answer: "A" }] })[0];
  assert.deepEqual(q.options, ["nur eine"]);
  assert.equal(q.correctIndex, 0);
});

test("resolveCorrectIndex reads a letter", () => {
  assert.equal(resolveCorrectIndex("B", FOUR), 1);
  assert.equal(resolveCorrectIndex("b)", FOUR), 1);
  assert.equal(resolveCorrectIndex("C", FOUR), 2);
});

// --- length bounds ----------------------------------------------------------

test("the requested length is clamped onto the supported range", () => {
  assert.equal(clampQuestionCount(10), 10);
  assert.equal(clampQuestionCount(0), MIN_QUESTIONS);
  assert.equal(clampQuestionCount(4), MIN_QUESTIONS);
  assert.equal(clampQuestionCount(1000), MAX_QUESTIONS);
  assert.equal(clampQuestionCount(12.6), 13);
  assert.equal(clampQuestionCount(Number.NaN), 10);
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

// --- Optionen als Objekt, Begründungen je Option -----------------------------

test("option objects carry the correctness flag and their own rationale", () => {
  const raw = {
    quiz: [{
      type: "FEHLER",
      question: "Welcher Fehler steckt in der Aussage?",
      options: [
        { text: "vorschnelle Verallgemeinerung", isCorrect: true, rationale: "die Aussage dehnt einen Einzelfall aus" },
        { text: "Zirkel", isCorrect: false, rationale: "der Beweis laeuft nicht im Kreis" },
        { text: "Widerspruch", isCorrect: false, rationale: "es liegt kein Gegensatz vor" },
        { text: "falsche Analogie", isCorrect: false, rationale: "es wird nichts verglichen" },
      ],
      hint: "Pruefe, ob ein Einzelfall verallgemeinert wird.",
      explanation: "Die Aussage dehnt einen Einzelfall aus.",
      topic: "Denkfehler",
    }],
  };
  const q = normaliseQuiz(raw, () => 0)[0];
  assert.equal(q.type, "FEHLER");
  assert.equal(q.options.length, 4);
  assert.equal(q.optionRationales.length, 4);
  // Die Reihenfolge ist gemischt, die Begruendung muss mit ihrer Option wandern.
  assert.equal(q.optionRationales[q.correctIndex], "die Aussage dehnt einen Einzelfall aus");
  assert.equal(q.options[q.correctIndex], "vorschnelle Verallgemeinerung");
  assert.deepEqual(sortedOptions(q.options), [
    "Widerspruch",
    "Zirkel",
    "falsche Analogie",
    "vorschnelle Verallgemeinerung",
  ]);
});

test("the correctness flag beats a wrong correct_answer text", () => {
  const raw = {
    quiz: [{
      question: "x",
      options: [
        { text: "Zellkern", isCorrect: false, rationale: "falsch" },
        { text: "Ribosom", isCorrect: true, rationale: "richtig" },
      ],
      correct_answer: "Zellkern",
    }],
  };
  const q = normaliseQuiz(raw, () => 0)[0];
  assert.equal(q.options[q.correctIndex], "Ribosom");
});

test("validateQuiz rejects rationales of the wrong length", () => {
  const broken = [{
    id: "q1",
    text: "x",
    options: ["a", "b"],
    correctIndex: 0,
    optionRationales: ["nur eine"],
    hint: "",
    explanation: "",
    topic: "",
    type: "WIEDERGEBEN",
  }];
  assert.equal(validateQuiz(broken).ok, false);
});

test("a hyphenated term keeps its leading letter", () => {
  const q = normaliseQuiz({ quiz: [{ question: "x", options: ["A-Dur", "H-Moll", "C-Dur"], correct_answer: "B" }] })[0];
  assert.deepEqual(sortedOptions(q.options), ["A-Dur", "C-Dur", "H-Moll"]);
  assert.equal(correctOption(q), "H-Moll");
});
