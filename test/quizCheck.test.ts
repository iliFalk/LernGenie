import { test } from "node:test";
import assert from "node:assert/strict";

import { checkQuiz, formatQuizFlags, summariseQuizFlags } from "../src/ai/quizCheck";
import type { QuizQuestion } from "../src/contracts/quiz";

const MATERIAL =
  "Die Photosynthese laeuft in den Chloroplasten ab. Chlorophyll absorbiert das Licht. " +
  "Aus Kohlendioxid und Wasser entstehen Glukose und Sauerstoff. Die Lichtreaktion findet in " +
  "den Thylakoiden statt, der Calvin-Zyklus im Stroma.";

const question = (overrides: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id: "q1",
  type: "WIEDERGEBEN",
  text: "Wo laeuft die Photosynthese ab?",
  options: ["in den Chloroplasten", "in den Thylakoiden", "im Calvin-Zyklus", "im Chlorophyll"],
  correctIndex: 0,
  optionRationales: ["steht im Material", "dort laeuft die Lichtreaktion", "dort laeuft der Zyklus", "dort wird Licht absorbiert"],
  hint: "Achte auf den Ort.",
  explanation: "Das Material nennt die Chloroplasten.",
  topic: "Photosynthese",
  ...overrides,
});

const context = { source: MATERIAL };

test("a clean question passes", () => {
  const result = checkQuiz([question()], context);
  assert.equal(result.flagged, 0);
  assert.deepEqual(result.items, {});
});

test("uneven option lengths are reported", () => {
  const result = checkQuiz([question({ options: ["kurz", "ein sehr viel laengerer Text mit Zusatz", "mittel", "ok"] })], context);
  assert.match(result.items[1].join(" | "), /streuen/);
});

test("a correct option that is longer than any distractor is reported", () => {
  const result = checkQuiz(
    [question({
      options: ["in den Chloroplasten und damit an genau dem Ort, den das Material nennt", "im Zellkern", "im Blut", "im Wurzelwerk"],
    })],
    context,
  );
  assert.match(result.items[1].join(" | "), /richtige Option ist deutlich länger/);
});

test("a negation option is reported", () => {
  const result = checkQuiz([question({ options: ["nicht in den Chloroplasten", "im Zellkern", "im Blutkreislauf", "in den Wurzeln"] })], context);
  assert.match(result.items[1].join(" | "), /Verneinung/);
});

test("an option without a lexical anchor in the material is a soft signal", () => {
  const result = checkQuiz(
    [question({ options: ["in den Chloroplasten", "im Weltraumbahnhof", "im Chlorophyll", "im Calvin-Zyklus"] })],
    context,
  );
  assert.match(result.items[1].join(" | "), /keinen Wortanker/);
  assert.equal(result.flagged, 0, "ein plausibler Distraktor darf nicht repariert werden");
});

test("a missing justification is reported", () => {
  const result = checkQuiz([question({ optionRationales: ["steht im Material", "", "", ""] })], context);
  assert.match(result.items[1].join(" | "), /ohne Begründung/);
});

test("a stem with two question marks is a soft signal", () => {
  const result = checkQuiz([question({ text: "Was ist Ethik? Und was ist Philosophie?" })], context);
  assert.equal(result.flagged, 0);
  assert.equal(result.soft, 1);
});

test("a quiz without types is reported on the set level", () => {
  const quiz = [question({ type: "" }), question({ id: "q2", type: "" }), question({ id: "q3", type: "" })];
  const result = checkQuiz(quiz, context);
  assert.match(result.global.join(" | "), /von 3 Modulen/);
  assert.match(result.global.join(" | "), /reines Abfragen/);
});

test("a mixed quiz passes the set level", () => {
  const quiz = [
    question(),
    question({ id: "q2", type: "FOLGERUNG", text: "Was folgt aus dem Material?" }),
    question({ id: "q3", type: "FEHLER", text: "Was stimmt an der Behauptung nicht?" }),
  ];
  const result = checkQuiz(quiz, context);
  assert.deepEqual(result.global, []);
});

test("the repair prompt lists question number, text and reason", () => {
  const quiz = [question({ options: ["nicht in den Chloroplasten", "in den Thylakoiden", "im Calvin-Zyklus", "im Chlorophyll"] })];
  const flags = checkQuiz(quiz, context);
  const text = formatQuizFlags(quiz, flags);
  assert.match(text, /Frage 1/);
  assert.match(text, /Wo laeuft die Photosynthese ab\?/);
  assert.match(text, /Verneinung/);
});

test("only hard findings count as flagged, soft ones are counted apart", () => {
  const softOnly = [question({ options: ["in den Chloroplasten", "in den Thylakoiden", "im Calvin-Zyklus", "im Chlorophyll und im Stroma der Pflanzenzelle"] })];
  const soft = checkQuiz(softOnly, context);
  assert.equal(soft.flagged, 0);
  assert.equal(soft.soft, 1);
  assert.ok(soft.items[1].length > 0, "der weiche Befund bleibt im Bericht");
  assert.deepEqual(soft.hardItems, {});
  assert.equal(formatQuizFlags(softOnly, soft), "", "weiche Befunde gehen nicht in die Reparatur");

  const hard = [question({ options: ["nicht in den Chloroplasten", "in den Thylakoiden", "im Calvin-Zyklus", "im Chlorophyll"] })];
  const found = checkQuiz(hard, context);
  assert.equal(found.flagged, 1);
  assert.ok(found.hardItems[1].length > 0);
});

test("the log line names the hard and the soft findings", () => {
  const quiz = [question({ options: ["nicht in den Chloroplasten", "in den Thylakoiden", "im Calvin-Zyklus", "im Chlorophyll"] })];
  const text = summariseQuizFlags(checkQuiz(quiz, context));
  assert.match(text, /1 harte Beanstandung/);
});

// --- grade fit (2026-11-04) ---------------------------------------------------

const stepContext = { source: MATERIAL, grade: 6 };

test("a stem beyond the band limit for class 6 is soft, twice the limit is hard", () => {
  const eleven = "Welche Aufgabe hat der Farbstoff in der Zelle bei der Photosynthese genau?";
  const long = "Welche der folgenden Aussagen beschreibt die Aufgabe des Farbstoffs in der Zelle bei der Photosynthese am genauesten, vollstaendig und ohne Auslassung?";
  const short = checkQuiz([question({ text: eleven })], stepContext);
  assert.equal(short.flagged, 0);
  assert.match(Object.values(short.items).flat().join(" "), /über der Grenze/);
  const tooLong = checkQuiz([question({ text: long })], stepContext);
  assert.equal(tooLong.flagged, 1);
  assert.match(Object.values(tooLong.hardItems).flat().join(" "), /Stamm zu lang/);
});

test("the vocabulary of logic is hard in a stem and soft in an option", () => {
  const inStem = checkQuiz([question({ text: "Welcher Denkfehler steckt hier?" })], stepContext);
  assert.match(Object.values(inStem.hardItems).flat().join(" "), /Fachsprache im Stamm/);
  const inOption = checkQuiz([question({ options: ["zulaessige Umkehrung", "die Chloroplasten", "die Thylakoide", "der Zyklus"] })], stepContext);
  assert.equal(inOption.flagged, 0);
  assert.match(Object.values(inOption.items).flat().join(" "), /Fachsprache/);
});

test("a long option at class 6 is soft, not hard", () => {
  const options = ["die Chloroplasten", "die Thylakoide", "der Zyklus im Stroma der Chloroplasten mit allen Einzelheiten", "das Chlorophyll"];
  const result = checkQuiz([question({ options })], stepContext);
  assert.equal(result.flagged, 0);
  assert.match(Object.values(result.items).flat().join(" "), /Option 3 über der Grenze/);
});

// --- cross-checks (2026-11-04) ------------------------------------------------

test("a missing topic is hard, because the statistics group by it", () => {
  const result = checkQuiz([question({ topic: "" })], context);
  assert.equal(result.flagged, 1);
  assert.match(Object.values(result.hardItems).flat().join(" "), /kein topic/);
});

test("an explanation at twice the grade limit is repaired, one step over is only logged", () => {
  const over = "Wort ".repeat(15).trim() + ".";        // 15 Wörter, Grenze 12
  const twice = "Wort ".repeat(26).trim() + ".";       // 26 Wörter, über 24
  const logged = checkQuiz([question({ explanation: over })], stepContext);
  assert.equal(logged.flagged, 0);
  assert.match(Object.values(logged.items).flat().join(" "), /Erklärung über der Grenze/);
  const repaired = checkQuiz([question({ explanation: twice })], stepContext);
  assert.equal(repaired.flagged, 1);
  assert.match(Object.values(repaired.hardItems).flat().join(" "), /doppelt so lang/);
});
