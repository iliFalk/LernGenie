/**
 * Contract: text.
 *
 * Prose artifacts — the study guide, the Lernskript topic text and OCR — are not
 * JSON. The wrapper wraps the model answer in a single contract: `{ text }`.
 */

import { isRecord, type ValidationResult } from "./util";

export interface TextArtifact {
  text: string;
}

export const STUDY_GUIDE_SCHEMA_VERSION = 1;

export function normaliseText(raw: unknown): TextArtifact {
  if (typeof raw === "string") return { text: raw };
  if (raw === null || raw === undefined) return { text: "" };
  return { text: String(raw) };
}

export function validateText(value: unknown): ValidationResult<TextArtifact> {
  if (!isRecord(value)) return { ok: false, error: "text: ein Objekt mit dem Feld 'text' wurde erwartet." };
  if (typeof value.text !== "string" || !value.text.trim()) {
    return { ok: false, error: "text: das Feld 'text' darf nicht leer sein." };
  }
  return { ok: true, value: value as unknown as TextArtifact };
}
