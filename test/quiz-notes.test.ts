/**
 * The user's wish about the questions must reach the prompt — and must not touch the rules.
 *
 * The wish block is a separate section after the rule blocks: it sets the accent and picks the
 * text passages, while line limits, four options, one correct option and the question types stay
 * binding. A wish therefore never repeats a limit, and this test pins both halves.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildPrompt, quizNotesBlock, MAX_QUIZ_NOTES } from "../src/ai/prompts";

const input = { content: "Photosynthese: Chloroplasten, Licht, Wasser, CO2 -> Glukose, O2.", grade: 5, count: 5 };

test("a package without a wish carries no wish block", () => {
  const prompt = buildPrompt("quiz", input).prompt;
  assert.equal(prompt.includes("WÜNSCHE ZUM QUIZ"), false);
  assert.equal(quizNotesBlock("   "), "");
});

test("a wish reaches the quiz prompt", () => {
  const prompt = buildPrompt("quiz", { ...input, notes: "Frage vor allem nach dem Ort der Photosynthese." }).prompt;
  assert.match(prompt, /WÜNSCHE ZUM QUIZ/);
  assert.match(prompt, /Frage vor allem nach dem Ort der Photosynthese\./);
  // The rules name the four options and the JSON contract; the wish block must not replace them.
  assert.match(prompt, /AUSGABE — nur JSON/);
});

test("the wish block stays after the rules and before the output contract", () => {
  const prompt = buildPrompt("quiz", { ...input, notes: "Mehr Jahreszeiten." }).prompt;
  const wish = prompt.indexOf("WÜNSCHE ZUM QUIZ");
  const rules = prompt.indexOf("REGELN");
  const contract = prompt.indexOf("AUSGABE — nur JSON");
  assert.ok(rules !== -1 && wish !== -1 && contract !== -1, "all three blocks exist");
  assert.ok(rules < wish && wish < contract, `order rules=${rules} wish=${wish} contract=${contract}`);
});

test("a long wish is cut at the limit", () => {
  const long = "A".repeat(MAX_QUIZ_NOTES + 250);
  const block = quizNotesBlock(long);
  assert.equal(block.includes("A".repeat(MAX_QUIZ_NOTES)), true);
  assert.equal(block.includes("A".repeat(MAX_QUIZ_NOTES + 1)), false);
});
