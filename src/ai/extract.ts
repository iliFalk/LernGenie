/**
 * Extracts a JSON value from a model answer.
 *
 * The model wraps its answer in prose, a ```json fence, or leaves trailing
 * commas. This module finds the first JSON structure, scans to its matching
 * close (string- and escape-aware, so a brace inside a string does not fool it)
 * and parses it. Trailing commas are dropped only when a first parse fails, so
 * valid JSON is never rewritten.
 */

export type ExtractResult = { ok: true; value: unknown; error?: null } | { ok: false; value?: null; error: string };

function findStart(text: string): number {
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "{" || text[i] === "[") return i;
  }
  return -1;
}

function findMatchingClose(text: string, start: number): number {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function stripTrailingCommas(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      out += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }
    if (char === ",") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j += 1;
      if (text[j] === "}" || text[j] === "]") continue;
    }
    out += char;
  }
  return out;
}

export function extractJson(raw: unknown): ExtractResult {
  if (typeof raw !== "string") return { ok: false, error: "Die Antwort ist kein Text." };

  const start = findStart(raw);
  if (start === -1) return { ok: false, error: "In der Antwort wurde keine JSON-Struktur gefunden." };

  const end = findMatchingClose(raw, start);
  if (end === -1) return { ok: false, error: "Die JSON-Struktur in der Antwort ist unvollständig." };

  const json = raw.slice(start, end + 1);
  try {
    return { ok: true, value: JSON.parse(json) };
  } catch {
    try {
      return { ok: true, value: JSON.parse(stripTrailingCommas(json)) };
    } catch (error) {
      return { ok: false, error: `Die JSON-Struktur konnte nicht gelesen werden: ${(error as Error).message}` };
    }
  }
}
