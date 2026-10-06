import { test } from "node:test";
import assert from "node:assert/strict";

import { extractJson } from "../src/ai/extract";

const value = (raw: string): unknown => {
  const result = extractJson(raw);
  assert.equal(result.ok, true, `expected ok for: ${raw}`);
  return result.ok ? result.value : undefined;
};

test("reads a plain JSON object", () => {
  assert.deepEqual(value('{"a":1}'), { a: 1 });
});

test("reads a plain JSON array", () => {
  assert.deepEqual(value("[1,2]"), [1, 2]);
});

test("reads JSON inside a ```json fence", () => {
  assert.deepEqual(value('```json\n{"quiz":[{"id":"q1"}]}\n```'), { quiz: [{ id: "q1" }] });
});

test("reads JSON inside a fence without a language tag", () => {
  assert.deepEqual(value('```\n{"a":2}\n```'), { a: 2 });
});

test("reads JSON wrapped in prose", () => {
  assert.deepEqual(value('Hier ist das Quiz:\n{"quiz":[]}\nViel Erfolg!'), { quiz: [] });
});

test("tolerates trailing commas", () => {
  assert.deepEqual(value('{"quiz":[{"a":1},],}'), { quiz: [{ a: 1 }] });
});

test("braces inside strings do not close the structure", () => {
  assert.deepEqual(value('Vor {"text":"ein } Zeichen"} nach'), { text: "ein } Zeichen" });
});

test("returns a typed error when there is no JSON", () => {
  const result = extractJson("nur Text, kein JSON");
  assert.equal(result.ok, false);
});

test("returns a typed error when the structure is unbalanced", () => {
  const result = extractJson('{"a":1');
  assert.equal(result.ok, false);
});

test("returns a typed error for a non-string input", () => {
  const result = extractJson(null);
  assert.equal(result.ok, false);
});
