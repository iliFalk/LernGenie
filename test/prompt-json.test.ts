/**
 * A JSON prompt must name JSON.
 *
 * OpenCode Go routes one call to several upstreams, and some of them reject
 * `response_format: json_object` with 400 "Prompt must contain the word 'json'"
 * while the others accept the same call. A prompt that never says JSON therefore
 * fails on some requests and passes on others — the analysis report broke that way.
 * The word in the prompt removes the dependence on which upstream answers.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildPrompt, type ArtifactKind } from "../src/ai/prompts";

const jsonInputs: Array<[ArtifactKind, Record<string, unknown>]> = [
  ["quiz", { content: "Photosynthese: Chloroplasten, Licht, Wasser, CO2 -> Glukose, O2.", grade: 5, count: 10 }],
  ["flashcards", { content: "Photosynthese: Chloroplasten, Licht, Wasser, CO2 -> Glukose, O2.", grade: 5 }],
  ["analysis", { history: [{ topic: "Ort", isCorrect: true, question: "Wo läuft die Photosynthese?" }], grade: 5 }],
];

test("every JSON artifact asks for JSON in its prompt", () => {
  for (const [kind, input] of jsonInputs) {
    const spec = buildPrompt(kind, input);
    assert.equal(spec.isJson, true, `${kind} must request JSON mode`);
    assert.match(spec.prompt, /json/i, `${kind} prompt must contain the word JSON`);
  }
});

test("the analysis prompt keeps the output contract", () => {
  const spec = buildPrompt("analysis", { history: [], grade: 5 });
  assert.match(spec.prompt, /"strengths"/);
  assert.match(spec.prompt, /"topicPerformance"/);
});
