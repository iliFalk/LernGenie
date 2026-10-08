import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveMaxTokens } from "../llm";

test("a configured budget applies to every provider", () => {
  assert.equal(resolveMaxTokens("commandcode", "32768"), 32768);
  assert.equal(resolveMaxTokens("openrouter", "32768"), 32768);
  assert.equal(resolveMaxTokens("commandcode", "8192"), 8192);
});

test("without a configured budget the model default applies", () => {
  assert.equal(resolveMaxTokens("commandcode", undefined), undefined);
  assert.equal(resolveMaxTokens("commandcode", ""), undefined);
  assert.equal(resolveMaxTokens("gemini", undefined), undefined);
});

test("OpenRouter keeps a bounded default, because it reserves the full output window", () => {
  assert.equal(resolveMaxTokens("openrouter", undefined), 8192);
  assert.equal(resolveMaxTokens("openrouter", ""), 8192);
});

test("an unusable value falls back to the model default instead of breaking the call", () => {
  assert.equal(resolveMaxTokens("commandcode", "0"), undefined);
  assert.equal(resolveMaxTokens("commandcode", "-5"), undefined);
  assert.equal(resolveMaxTokens("commandcode", "keine Zahl"), undefined);
  assert.equal(resolveMaxTokens("commandcode", "1024.7"), 1024);
});
