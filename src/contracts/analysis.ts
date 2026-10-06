/**
 * Contract: analysis.
 *
 * The client reads `AnalysisData` (`src/types.ts`): `strengths`, `growthAreas`
 * and `topicPerformance`. All three are normalised to arrays so the client can
 * always iterate them.
 */

import { asNumber, asStringArray, asText, isRecord, pickKey, type ValidationResult } from "./util";

export interface TopicPerformance {
  topic: string;
  score: number;
  total: number;
}

export interface AnalysisData {
  strengths: string[];
  growthAreas: string[];
  topicPerformance: TopicPerformance[];
}

export const ANALYSIS_SCHEMA_VERSION = 1;

export function normaliseAnalysis(raw: unknown): AnalysisData {
  const performance = pickKey(raw, [
    "topicperformance",
    "topic_performance",
    "pertopic",
    "performance",
    "topics",
    "themen",
    "topicresults",
  ]);
  return {
    strengths: asStringArray(pickKey(raw, ["strengths", "staerken", "strongpoints"])),
    growthAreas: asStringArray(
      pickKey(raw, ["growthareas", "areasforimprovement", "lernbereiche", "schwaechen", "weaknesses"]),
    ),
    topicPerformance: Array.isArray(performance)
      ? performance.map((entry) => ({
          topic: asText(pickKey(entry, ["topic", "thema", "name"])),
          score: asNumber(pickKey(entry, ["score", "punkte", "correct", "richtig", "correctanswers"])),
          total: asNumber(pickKey(entry, ["total", "gesamt", "questions", "anzahl", "totalquestions"])),
        }))
      : [],
  };
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export function validateAnalysis(value: unknown): ValidationResult<AnalysisData> {
  if (!isRecord(value)) return { ok: false, error: "analysis: ein Objekt wurde erwartet." };
  if (!isStringArray(value.strengths)) return { ok: false, error: "analysis: 'strengths' muss eine Liste von Texten sein." };
  if (!isStringArray(value.growthAreas)) {
    return { ok: false, error: "analysis: 'growthAreas' muss eine Liste von Texten sein." };
  }
  if (!Array.isArray(value.topicPerformance)) {
    return { ok: false, error: "analysis: 'topicPerformance' muss eine Liste sein." };
  }

  for (let i = 0; i < value.topicPerformance.length; i += 1) {
    const entry = value.topicPerformance[i];
    const label = `analysis: Eintrag ${i + 1} in 'topicPerformance'`;
    if (!isRecord(entry)) return { ok: false, error: `${label} ist kein Objekt.` };
    if (typeof entry.topic !== "string") return { ok: false, error: `${label} hat kein Thema.` };
    if (typeof entry.score !== "number" || typeof entry.total !== "number") {
      return { ok: false, error: `${label} hat keine Zahlenwerte.` };
    }
  }

  return { ok: true, value: value as unknown as AnalysisData };
}
