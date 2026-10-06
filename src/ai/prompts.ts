/**
 * Prompts: the data plus the output contract. Nothing else.
 *
 * The didactic German text is kept. Presentation and wording rules are gone —
 * the wrapper, not the model, owns structure.
 */

export type ArtifactKind = "quiz" | "flashcards" | "analysis" | "text";

export interface PromptSpec {
  prompt: string;
  isJson?: boolean;
  useFlashModel?: boolean;
  imageData?: { data: string; mimeType: string };
}

/** The exact JSON (or prose) shape each artifact must have. Reused in the repair retry. */
export const OUTPUT_CONTRACT: Record<ArtifactKind, string> = {
  quiz: '{"quiz":[{"question":"...","options":["...","..."],"correct_answer":"<exakter Text der richtigen Option>","hint":"...","explanation":"...","topic":"..."}]}',
  flashcards: '{"flashcards":[{"front":"...","back":"..."}]}',
  analysis: '{"strengths":["..."],"growthAreas":["..."],"topicPerformance":[{"topic":"...","score":0,"total":0}]}',
  text: "Reiner Text in Markdown, kein JSON.",
};

const quizPrompt = (count: number, grade: number, content: string): string => `
Du bist ein pädagogischer Experte für tiefgehendes Verständnis.
Analysiere das folgende Lernmaterial und erstelle ein Quiz mit ${count} Multiple-Choice-Fragen für die Klassenstufe ${grade}.

Regeln:
1. QUELLENTREUE: Alle Fragen stützen sich ausschließlich auf den bereitgestellten Inhalt. Erfinde keine Fakten.
2. DIDAKTIK: Die Sprache ist für Klassenstufe ${grade} angemessen und intellektuell anregend.
3. Jede Frage hat einen Hinweis (hint), der zum Nachdenken anregt, ohne die Lösung zu verraten, eine ausführliche Erklärung (explanation) und ein Thema (topic).

Ausgabe-Vertrag — halte ihn exakt ein:
${OUTPUT_CONTRACT.quiz}
Jede Frage hat mindestens zwei Optionen. Die Optionen sind reine Antworttexte ohne Präfix wie "A)". "correct_answer" ist der exakte Text einer der Optionen.

Material:
${content}
`;

const flashcardsPrompt = (content: string): string => `
Erstelle 10 hochwertige Karteikarten (Flashcards) aus dem folgenden Material.
Folge dem Prinzip des "Active Recall": Die Vorderseite ist eine gezielte Frage oder ein Konzept, die Rückseite eine prägnante, erklärende Antwort im Stil eines Experten-Tutors.

Ausgabe-Vertrag — halte ihn exakt ein:
${OUTPUT_CONTRACT.flashcards}

Material:
${content}
`;

const analysisPrompt = (history: string): string => `
Du bist ein persönlicher Lern-Coach. Analysiere die folgende Quiz-Performance. Identifiziere nicht nur Fehler, sondern Muster im Verständnis des Schülers.

Performance-Daten:
${history}

Der Bericht benennt konkrete Stärken (strengths), spezifische Lernbereiche (growthAreas) und eine statistische Auswertung pro Thema (topicPerformance).

Ausgabe-Vertrag — halte ihn exakt ein:
${OUTPUT_CONTRACT.analysis}
`;

const studyGuidePrompt = (content: string): string => `
Du bist ein KI-Studienassistent. Erstelle einen umfassenden, strukturierten Study Guide aus dem folgenden Material.

Struktur des Guides:
1. EXEKUTIVE ZUSAMMENFASSUNG: Der Kern des Themas in 3 Sätzen.
2. SCHLÜSSELKONZEPTE: Detaillierte Erläuterung der wichtigsten Begriffe.
3. DEEP DIVE: Analyse von Zusammenhängen und "Warum"-Fragen.
4. SCHNELL-CHECK: 5 Kernpunkte zum Merken.

Verwende Markdown für eine klare Hierarchie.

Material:
${content}
`;

const topicPrompt = (topic: string, grade: number): string => `
Du bist ein Wissens-Kurator. Erstelle eine umfassende "Source of Truth" zum Thema "${topic}" für die Klassenstufe ${grade}.

Auftrag: ein Text wie ein perfekt recherchiertes Kapitel eines modernen, digitalen Lehrbuchs.
1. KLARHEIT: Sprache für Klassenstufe ${grade} verständlich, ohne Details auszulassen.
2. STRUKTUR: Einleitung (Warum ist das Thema wichtig?), Hauptteil mit klaren Überschriften, Beispiele aus der Lebenswelt der Schüler, Zusammenfassung mit den wichtigsten Take-aways.
3. FORMAT: Markdown (Fettdruck, Listen, Tabellen wo sinnvoll).

Schreibe so, dass dieser Text als verlässliche Basis für Quizze und Karten dient.
`;

const OCR_PROMPT =
  "Extrahiere den gesamten Text aus diesem Bild. Transkribiere handgeschriebene Notizen so genau wie möglich. Gib nur den extrahierten Text zurück.";

const textPrompt = (input: Record<string, unknown>): PromptSpec => {
  const variant = input.variant;
  if (variant === "ocr") {
    const image = input.image as { data?: string; mimeType?: string } | undefined;
    return {
      prompt: OCR_PROMPT,
      useFlashModel: true,
      imageData: image ? { data: String(image.data ?? ""), mimeType: String(image.mimeType ?? "") } : undefined,
    };
  }
  if (variant === "topic") {
    return { prompt: topicPrompt(String(input.topic ?? ""), Number(input.grade) || 0) };
  }
  return { prompt: studyGuidePrompt(String(input.content ?? "")), useFlashModel: true };
};

export function buildPrompt(kind: ArtifactKind, input: Record<string, unknown>): PromptSpec {
  switch (kind) {
    case "quiz":
      return {
        prompt: quizPrompt(Number(input.count) || 10, Number(input.grade) || 0, String(input.content ?? "")),
        isJson: true,
      };
    case "flashcards":
      return { prompt: flashcardsPrompt(String(input.content ?? "")), isJson: true, useFlashModel: true };
    case "analysis":
      return { prompt: analysisPrompt(JSON.stringify(input.history ?? [])), isJson: true, useFlashModel: true };
    case "text":
      return textPrompt(input);
  }
}
