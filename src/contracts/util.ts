/**
 * Shared helpers for the artifact contracts.
 *
 * The model answers in its own key style: PascalCase, German words or synonyms
 * (`Quiz`/`Question`/`CorrectAnswer`, `Frage`, `Antwort`). A contract normaliser
 * maps such an answer onto the fixed shape the UI reads; the validator then
 * decides whether the mapped value is usable.
 */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Result of a contract validator: the typed value or a readable reason.
 *
 * The optional field keeps the union narrowing-safe on this project's
 * tsconfig, which runs without `strictNullChecks` (a boolean-literal
 * discriminant does not narrow there). Both members declare both fields, so
 * callers read `.value` / `.error` after an `.ok` check without a type guard.
 */
export type ValidationResult<T> = { ok: true; value: T; error?: null } | { ok: false; value?: null; error: string };

const normaliseKey = (key: string): string =>
  key
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");

/** Returns the value of the first key whose normalised form matches one of `names`. */
export function pickKey(source: unknown, names: string[]): unknown {
  if (!isRecord(source)) return undefined;
  const wanted = names.map(normaliseKey);
  for (const key of Object.keys(source)) {
    if (wanted.includes(normaliseKey(key))) return source[key];
  }
  return undefined;
}

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => (item === null || item === undefined ? "" : String(item)));
  if (value === null || value === undefined) return [];
  return [String(value)];
}

export function asNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function asText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}
