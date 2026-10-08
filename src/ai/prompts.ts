/**
 * Prompts: the data plus the output contract. Nothing else.
 *
 * The didactic German text is kept. Presentation and wording rules are gone —
 * the wrapper, not the model, owns structure.
 */

import { clampQuestionCount, MAX_QUESTIONS } from "../contracts/quiz";

export type ArtifactKind = "quiz" | "flashcards" | "analysis" | "text";

export interface PromptSpec {
  prompt: string;
  isJson?: boolean;
  useFlashModel?: boolean;
  imageData?: { data: string; mimeType: string };
  /** Number of items the answer must finally contain; a surplus is requested and trimmed. */
  targetCount?: number;
}

/**
 * Questions the model may return beyond `target`. The answer is generated with a
 * surplus and the gateway keeps the first `target` distinct questions, so a
 * repeated question costs nothing.
 */
export const questionSurplus = (target: number): number => Math.max(3, Math.ceil(target * 0.3));

/** The exact JSON (or prose) shape each artifact must have. Reused in the repair retry. */
export const OUTPUT_CONTRACT: Record<ArtifactKind, string> = {
  quiz: '{"quiz":[{"type":"<Aufgabentyp>","question":"...","options":[{"text":"...","isCorrect":true,"rationale":"≤8 Wörter"},{"text":"...","isCorrect":false,"rationale":"≤8 Wörter"}],"hint":"≤8 Wörter","explanation":"≤15 Wörter","topic":"Stichwort"}]}',
  flashcards: '{"flashcards":[{"front":"...","back":"..."}]}',
  analysis: '{"strengths":["..."],"growthAreas":["..."],"topicPerformance":[{"topic":"...","score":0,"total":0}]}',
  text: "Reiner Text in Markdown, kein JSON.",
};

/**
 * The three modules and their share of the questions. The structure follows the
 * Soviet school course in traditional logic (Winogradow/Kusmin, 1954): terms and
 * their marks, conclusive inference, then the traps that catch unexamined
 * assumptions (the puzzle type of Perelman's «Занимательная логика», which is a
 * collection of his 1910s-30s puzzles, and the error exercises in the 1954
 * appendix — "danach heißt deshalb", superstitious pseudo-causality).
 *
 * The module mix is a share, not a promise: a short material cannot carry three
 * inference questions, and the prompt says so.
 */
export const quizModules = (count: number): { begriffe: number; schluesse: number; fangfragen: number } => {
  const begriffe = Math.max(1, Math.round(count * 0.3));
  const schluesse = Math.max(1, Math.round(count * 0.4));
  return { begriffe, schluesse, fangfragen: Math.max(1, count - begriffe - schluesse) };
};

const previousBlock = (previous: string[]): string =>
  previous.length === 0
    ? ""
    : `
Diese Fragen wurden bereits gestellt. Prüfe andere Textstellen und andere Aspekte des Materials — keine inhaltliche Wiederholung:
${previous.map((text) => `- ${text}`).join("\n")}
`;

const quizPrompt = (count: number, grade: number, content: string, previous: string[] = []): string => {
  const modules = quizModules(count);
  // A compact instruction matters for the runtime, not for style: measured with the same
  // model, material and question count, a terse prompt answered in 72 s where the verbose
  // one (long module prose plus eight prose rules) needed 204 s, and its own rationales
  // came out shorter (median 9 words against 14).
  return `
Du bist Fachdidaktiker für Klasse ${grade}. Die Fragen prüfen Denkoperationen nach der klassischen
Logik (Begriff, Urteil, Schluss); sie fragen keine Sätze ab.

${count} Multiple-Choice-Fragen, verteilt auf drei Module:
1. BEGRIFFE (${modules.begriffe}, type BEZIEHUNG oder WIEDERGEBEN): Merkmale trennen, Ober-/Unterbegriff,
   Definition prüfen.
2. SCHLÜSSE (${modules.schluesse}, type FOLGERUNG oder AUSSCHLUSS): zwingend aus dem Material folgern.
   Falle: unzulässige Umkehrung. Bei AUSSCHLUSS nennt der Stamm eine Materialaussage, die Optionen
   sind einzelne Sätze; gesucht ist der Satz, der mit dem Stamm nicht zugleich wahr sein kann.
3. FANGFRAGE (${modules.fangfragen}, type FEHLER oder GRUND/FOLGE): Denkfehler benennen —
   Begriffsvertauschung, Zirkel, vorschnelle Verallgemeinerung, falsche Analogie, Widerspruch,
   Umkehrung des Schlusses, "danach heißt deshalb", übersehene Bedingung.

REGELN
- Nur Aussagen des Materials. Trägt es ein Modul nicht, verteile die Fragen um. Keine neue Prämisse.
- Streuung: verschiedene Textstellen und verschiedene Aspekte. Höchstens ein Drittel der Fragen
  darf ein Faktum abfragen (type WIEDERGEBEN).
- Stamm: eine Frage, kein Lösungshinweis. Bei FEHLER und AUSSCHLUSS steht die Aussage im Stamm.
- Genau 4 Optionen, grammatisch parallel, ähnliche Länge. Keine Option beginnt mit ohne/nicht/kein/niemals.
- Jede falsche Option ist ein typischer Denkfehler aus derselben Textstelle, unterschieden in EINEM
  Merkmal. Keine Option, die im Material nicht vorkommt.
- Die richtige Option ist nicht die längste; die richtige Position wechselt.
- rationale: die Regel in höchstens 8 Wörtern, ohne Wiederholung der Option. hint ≤8 Wörter ohne
  Lösung. explanation ≤15 Wörter. topic: Stichwort.
${previousBlock(previous)}
AUSGABE — nur JSON:
${OUTPUT_CONTRACT.quiz}
Genau eine Option trägt "isCorrect": true.

MATERIAL (${content.length} Zeichen), Klasse ${grade}:
${content}
`;
};

/**
 * Repair prompt for the quality pass. The gateway runs the mechanical checks over a
 * generated quiz and, when they flag questions, sends this prompt: the model
 * rewrites only the flagged items and leaves the rest untouched.
 */
export const quizRepairPrompt = (quiz: unknown, flags: string, content: string, grade: number): string => `
Du prüfst ein Multiple-Choice-Quiz für Klassenstufe ${grade} und verbesserst die beanstandeten Fragen.

BEANSTANDETE FRAGEN und Grund:
${flags}

Auftrag: Ersetze NUR die beanstandeten Fragen durch neue, die den Grund beheben. Alle übrigen Fragen
bleiben wörtlich unverändert und in derselben Reihenfolge. Die Regeln des Ursprungsauftrags gelten:
genau vier Optionen, grammatisch parallel, ähnliche Länge (unter 30 % Abweichung), keine Option
beginnt mit "ohne", "nicht", "kein" oder "niemals", jede falsche Option stammt aus derselben
Textstelle und unterscheidet sich in EINEM Merkmal, keine Option, die im Material nicht vorkommt,
die richtige Option ist nicht länger als jede falsche, jede Option trägt ihre eigene rationale in
höchstens 8 Wörtern, hint höchstens 8, explanation höchstens 15 Wörter. Typ und topic der
ersetzten Frage bleiben erhalten.

QUIZ (JSON):
${JSON.stringify(quiz)}

MATERIAL (${content.length} Zeichen):
${content}

Ausgabe-Vertrag — halte ihn exakt ein:
${OUTPUT_CONTRACT.quiz}
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
    case "quiz": {
      const target = clampQuestionCount(Number(input.count));
      const previous = Array.isArray(input.previous) ? input.previous.map(String).filter(Boolean) : [];
      // The surplus exists to replace a question that repeats an earlier one. Without an
      // earlier set there is nothing to replace, and the longer answer only risks
      // running into the output limit. Above the ceiling the surplus would too.
      const asked = previous.length > 0 ? Math.min(target + questionSurplus(target), MAX_QUESTIONS) : target;
      return {
        prompt: quizPrompt(asked, Number(input.grade) || 0, String(input.content ?? ""), previous),
        isJson: true,
        targetCount: target,
      };
    }
    case "flashcards":
      return { prompt: flashcardsPrompt(String(input.content ?? "")), isJson: true, useFlashModel: true };
    case "analysis":
      return { prompt: analysisPrompt(JSON.stringify(input.history ?? [])), isJson: true, useFlashModel: true };
    case "text":
      return textPrompt(input);
  }
}

/**
 * Prompt for the subject classifier used by `/api/packages` and `/api/results`.
 * It is a helper, not one of the four artifacts — it returns a bare subject name,
 * not a contract. It lives here so `server.ts` holds no prompt text.
 */
export const subjectClassificationPrompt = (name: string, materialsContext: string): string => `
Du bist ein intelligenter Assistent für Schüler und Lehrer. Deine Aufgabe ist es, anhand des Namens eines Lernpakets (und eventuellen Inhalten der Dokumente) das passende schulische Hauptfach auf Deutsch zuzuordnen.
Wähle ausschließlich eines der folgenden Standard-Schulfächer aus:
- Mathematik
- Deutsch
- Englisch
- Französisch
- Spanisch
- Latein
- Biologie
- Physik
- Chemie
- Geschichte
- Geographie
- Wirtschaft
- Informatik
- Politik & Sozialwissenschaften
- Religion & Ethik
- Musik
- Kunst
- Sport
- Sonstiges (nur wenn absolut unklar)

Gib NUR den genauen Namen dieses Fachs zurück, ohne zusätzliche Sätze, Zeichen, Erklärungen oder Formatierungen.
Beispiel Name: "Matheklausur Terme"
Ausgabe: Mathematik

Beispiel Name: "Vocab Unit 3"
Ausgabe: Englisch

Eingabe Name: "${name}"
Material-Kontext: "${materialsContext}"
Ausgabe:`;
