/**
 * The free models answer in their own key style: PascalCase, German words, or synonyms
 * (`Quiz`/`Question`/`CorrectAnswer`, `Frage`, `Antwort`). The UI reads fixed keys, so every JSON
 * answer is mapped to the shape the client expects before it leaves the server.
 *
 * A missing field becomes an empty string, an unknown correct answer becomes -1. Nothing throws.
 */

const pickKey = (source: any, names: string[]): any => {
  if (!source || typeof source !== "object") return undefined;
  const wanted = names.map((name) => name.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const key of Object.keys(source)) {
    if (wanted.includes(key.toLowerCase().replace(/[^a-z0-9]/g, ""))) return source[key];
  }
  return undefined;
};

const asStringArray = (value: any): string[] =>
  Array.isArray(value) ? value.map((item) => String(item)) : value ? [String(value)] : [];

const asNumber = (value: any): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

/** Accepts a letter ("B", "C)"), a number (1-based, or 0), or the option text itself. */
export function resolveCorrectIndex(value: any, options: string[]): number {
  if (typeof value === "number") return value > 0 && value <= options.length ? value - 1 : value;
  if (typeof value === "string") {
    const text = value.trim();
    const letter = text.match(/^([A-Ha-h])\)?\s*$/);
    if (letter) return letter[1].toUpperCase().charCodeAt(0) - 65;
    if (/^\d+$/.test(text)) return resolveCorrectIndex(Number(text), options);
    const strip = (option: string) => option.replace(/^[A-Ha-h]\)\s*/, "").trim().toLowerCase();
    const index = options.findIndex((option) => strip(option) === strip(text));
    if (index !== -1) return index;
  }
  return -1;
}

export function normaliseQuiz(raw: any): any[] {
  const list = Array.isArray(raw) ? raw : pickKey(raw, ["quiz", "questions", "fragen", "items", "mcq"]);
  if (!Array.isArray(list)) return [];
  return list.map((entry: any, position: number) => {
    const options = asStringArray(pickKey(entry, ["options", "answers", "choices", "antworten", "optionen"]));
    const rawCorrect = pickKey(entry, [
      "correct_answer", "correctanswer", "correct_index", "correctoption", "correctoptionindex",
      "correct", "answer", "richtige_antwort", "loesung", "loesungindex",
    ]);
    return {
      id: String(pickKey(entry, ["id", "uuid"]) ?? `q${position + 1}`),
      text: String(pickKey(entry, ["question", "text", "frage", "title", "prompt"]) ?? ""),
      options,
      correctIndex: resolveCorrectIndex(rawCorrect, options),
      hint: String(pickKey(entry, ["hint", "hinweis", "tip", "tipp"]) ?? ""),
      explanation: String(
        pickKey(entry, ["explanation", "explanationtext", "erklaerung", "why", "reason", "begruendung"]) ?? ""
      ),
      topic: String(pickKey(entry, ["topic", "thema", "subject", "fach"]) ?? ""),
    };
  });
}

export function normaliseFlashcards(raw: any): any[] {
  const list = Array.isArray(raw) ? raw : pickKey(raw, ["flashcards", "cards", "karten", "karteikarten"]);
  if (!Array.isArray(list)) return [];
  return list.map((entry: any) => ({
    front: String(pickKey(entry, ["front", "question", "frage", "vorderseite", "term", "begriff"]) ?? ""),
    back: String(
      pickKey(entry, ["back", "answer", "antwort", "rueckseite", "definition", "explanation"]) ?? ""
    ),
  }));
}

export function normaliseAnalysis(raw: any): {
  strengths: string[];
  growthAreas: string[];
  topicPerformance: { topic: string; score: number; total: number }[];
} {
  const performance = pickKey(raw, [
    "topicperformance", "topic_performance", "pertopic", "performance", "topics", "themen", "topicresults",
  ]);
  return {
    strengths: asStringArray(pickKey(raw, ["strengths", "staerken", "strongpoints"])),
    growthAreas: asStringArray(
      pickKey(raw, ["growthareas", "areasforimprovement", "lernbereiche", "schwaechen", "weaknesses"])
    ),
    topicPerformance: Array.isArray(performance)
      ? performance.map((entry: any) => ({
          topic: String(pickKey(entry, ["topic", "thema", "name"]) ?? ""),
          score: asNumber(pickKey(entry, ["score", "punkte", "correct", "richtig", "correctanswers"])),
          total: asNumber(pickKey(entry, ["total", "gesamt", "questions", "anzahl", "totalquestions"])),
        }))
      : [],
  };
}
