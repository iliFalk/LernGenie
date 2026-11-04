import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MarkdownText } from "../src/components/MarkdownText";

test("a markdown table renders as an HTML table, not as pipes", () => {
  const md = "| Begriff | Bedeutung |\n|---|---|\n| ATP | Energieträger |";
  const html = renderToStaticMarkup(React.createElement(MarkdownText, null, md));
  assert.match(html, /<table>/);
  assert.match(html, /<th>/);
  assert.match(html, /<td>/);
  assert.doesNotMatch(html, /\|---/);
});

test("strikethrough and task lists render through GFM", () => {
  const html = renderToStaticMarkup(React.createElement(MarkdownText, null, "~~alt~~ und\n\n- [x] fertig"));
  assert.match(html, /<del>/);
  assert.match(html, /type="checkbox"/);
});

test("plain prose keeps working", () => {
  const html = renderToStaticMarkup(React.createElement(MarkdownText, null, "**Fett** und *kursiv*"));
  assert.match(html, /<strong>Fett<\/strong>/);
  assert.match(html, /<em>kursiv<\/em>/);
});
