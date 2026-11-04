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
  quiz: '{"quiz":[{"type":"<Aufgabentyp>","question":"...","options":[{"text":"...","isCorrect":true,"rationale":"..."},{"text":"...","isCorrect":false,"rationale":"..."}],"hint":"...","explanation":"...","topic":"Stichwort"}]}',
  flashcards: '{"flashcards":[{"front":"...","back":"..."}]}',
  analysis: '{"strengths":["..."],"growthAreas":["..."],"topicPerformance":[{"topic":"...","score":0,"total":0}]}',
  text: "Reiner Text in Markdown, kein JSON.",
};

/**
 * Language and structure policy per grade band.
 *
 * The grade used to stand in the prompt as a label only, and the model answered in the
 * register of the source material. Measured with the Wiener Sachtextformel on the live
 * caches: a Klasse-6 paket produced question stems at level 9.7 and explanations at 14.4,
 * while a maths paket at the same grade stayed at 6.9. The numbers below turn the label
 * into a limit the quality pass can also check.
 */
export interface GradeStyle {
  /** Upper bound for the words of one question stem. */
  stem: number;
  /** Upper bound for the words of one option. */
  option: number;
  /** Upper bound for the words of one explanation. */
  explanation: number;
  /** Upper bound for the words of one sentence in a prose artifact (topic text, analysis). */
  text: number;
  /** Share of the question modules: terms, inferences, traps. */
  mix: [number, number, number];
}

export const gradeStyle = (grade: number): GradeStyle => {
  if (grade > 0 && grade <= 6) {
    return { stem: 10, option: 8, explanation: 20, text: 12, mix: [0.5, 0.3, 0.2] };
  }
  if (grade <= 9) return { stem: 14, option: 10, explanation: 25, text: 16, mix: [0.3, 0.4, 0.3] };
  return { stem: 18, option: 12, explanation: 30, text: 20, mix: [0.3, 0.4, 0.3] };
};

/**
 * The three modules and their share of the questions. The structure follows the
 * Soviet school course in traditional logic (Winogradow/Kusmin, 1954): terms and
 * their marks, conclusive inference, then the traps that catch unexamined
 * assumptions (the puzzle type of Perelman's «Занимательная логика», which is a
 * collection of his 1910s-30s puzzles, and the error exercises in the 1954
 * appendix — "danach heißt deshalb", superstitious pseudo-causality).
 *
 * The share depends on the grade: a young pupil works with terms and their marks, an
 * older one with inferences and traps. The mix is a target, not a promise: a short
 * material cannot carry three inference questions, and the prompt says so.
 */
export const quizModules = (count: number, grade = 9, hard = false): { begriffe: number; schluesse: number; fangfragen: number } => {
  const shares: [number, number, number] = hard ? [0.2, 0.5, 0.3] : gradeStyle(grade).mix;
  const [termsShare, inferenceShare] = shares;
  let begriffe = Math.max(1, Math.round(count * termsShare));
  let schluesse = Math.max(1, Math.round(count * inferenceShare));
  let fangfragen = count - begriffe - schluesse;
  if (fangfragen < 1) {
    // A short quiz keeps one trap and takes its share from the larger module.
    fangfragen = 1;
    if (begriffe >= schluesse) begriffe = Math.max(1, count - schluesse - fangfragen);
    else schluesse = Math.max(1, count - begriffe - fangfragen);
  }
  return { begriffe, schluesse, fangfragen };
};

/**
 * Content and form rules. One source for the quiz prompt and the repair prompt: a copy
 * drifted before — the repair copy still asked for 15-word explanations while the grade
 * block allowed 20 to 30. Each rule is one line and one thought.
 */
export const quizRules = (): string => `REGELN
- Nimm nur Aussagen aus dem Material.
- Erfinde keine Aussage, die nicht im Material steht.
- Verteile die Fragen über verschiedene Textstellen und Aspekte.
- Frage höchstens ein Drittel der Fragen als reines Faktum ab (type WIEDERGEBEN).
- Stelle in einem Stamm genau eine Frage.
- Gib im Stamm keinen Lösungshinweis.
- Setze bei FEHLER und AUSSCHLUSS die Aussage in den Stamm.
- Verweise im Stamm nicht auf die Quelle: kein "laut Material", kein "im Text".
- Gib genau vier Optionen.
- Formuliere die Optionen grammatisch parallel.
- Halte die Optionen gleich lang. Abweichung höchstens 35 %.
- Beginne keine Option mit ohne, nicht, kein oder niemals.
- Nimm die falsche Option aus derselben Textstelle wie die richtige.
- Unterscheide eine falsche Option in genau EINEM Merkmal.
- Nimm keine Option auf, die im Material nicht vorkommt.
- Mache die richtige Option nicht zur längsten.
- Wechsle die Position der richtigen Option.
- Fasse die Begründung in höchstens 8 Wörter.
- Fasse den Hinweis in höchstens 8 Wörter.
- Nenne als topic ein Stichwort.`;

const previousBlock = (previous: string[]): string =>
  previous.length === 0
    ? ""
    : `
Diese Fragen wurden bereits gestellt. Prüfe andere Textstellen und andere Aspekte des Materials — keine inhaltliche Wiederholung:
${previous.map((text) => `- ${text}`).join("\n")}
`;

const quizPrompt = (count: number, grade: number, content: string, previous: string[] = [], hard = false): string => {
  const modules = quizModules(count, grade, hard);
  const style = gradeStyle(grade);
  // A compact instruction matters for the runtime, not for style: measured with the same
  // model, material and question count, a terse prompt answered in 72 s where the verbose
  // one (long module prose plus eight prose rules) needed 204 s, and its own rationales
  // came out shorter (median 9 words against 14).
  return `
Du schreibst ein Quiz für Klasse ${grade}. Die Fragen prüfen Denken — Begriff, Urteil, Schluss —,
sie fragen keine Sätze ab.

SPRACHE (gilt für Stamm, Optionen, Hinweis und Erklärung)
- Style: ~80 % of the way to ASD-STE100: one thought per sentence; a verb over an abstract noun;
  active over passive; three or more items go vertical; cut, never decorate.
- Höchstens ${style.stem} Wörter im Stamm.
- Höchstens ${style.option} Wörter in einer Option.
- Höchstens ${style.explanation} Wörter in einer Erklärung.
- Nur Wörter, die ein Kind der Klasse ${grade} kennt.
- Erkläre ein Fachwort aus dem Material im Stamm in einfachen Worten.
- Nimm Beispiele aus Schule, Familie, Spiel oder Sport.
- Diese Wörter stehen nicht im Stamm und nicht in den Optionen:
  Denkfehler, Schluss, Prämisse, Umkehrung, Verallgemeinerung,
  Zirkel, Analogie, Begriffsvertauschung, zwingend, logisch.
- Zitiere ein solches Wort nur, wenn es im Material steht.
- Erkläre die Regel in der Sprache des Kindes. Benenne sie nicht.

${count} Multiple-Choice-Fragen, verteilt auf drei Module:
1. BEGRIFFE (${modules.begriffe}, type BEZIEHUNG oder WIEDERGEBEN): Merkmale trennen, Ober-/Unterbegriff,
   Definition prüfen.
2. SCHLÜSSE (${modules.schluesse}, type FOLGERUNG oder AUSSCHLUSS): was sicher aus dem Material folgt.
   Achtung: eine Umkehrung ist kein gültiger Schluss.
   Bei AUSSCHLUSS nennt der Stamm eine Materialaussage.
   Die Optionen sind einzelne Sätze.
   Gesucht ist der Satz, der mit dem Stamm nicht zugleich wahr sein kann.
3. FANGFRAGE (${modules.fangfragen}, type FEHLER oder GRUND/FOLGE): der Stamm zitiert eine Behauptung.
   Der Stamm fragt, was daran nicht stimmt.
   Die Optionen beschreiben den Fehler in einfachen Worten.
   Beispiel: "Man schließt von einem Fall auf alle."
   Beispiel: "Der Grund wird mit der Folge verwechselt."
${hard ? `
STUFE SCHWER — jede Frage verlangt zwei Schritte:
- Kein WIEDERGEBEN. Jede Frage braucht einen Schluss, einen Vergleich oder eine Fehlerprüfung.
- Mindestens drei Fragen verbinden zwei Aussagen des Materials.
- Die falschen Optionen unterscheiden sich in einem feinen Merkmal.
- Keine falsche Option ist grob falsch.
- Die richtige Option steht nie wörtlich im Material.
- Die richtige Option fasst das Material in eigenen Worten zusammen.
` : ""}

${quizRules()}
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
export const quizRepairPrompt = (quiz: unknown, flags: string, content: string, grade: number): string => {
  const style = gradeStyle(grade);
  return `
Du prüfst ein Multiple-Choice-Quiz für Klassenstufe ${grade}.

BEANSTANDETE FRAGEN und Grund:
${flags}

AUFTRAG
- Ersetze nur die beanstandeten Fragen.
- Lass alle übrigen Fragen wörtlich unverändert.
- Behalte die Reihenfolge.
- Behalte type und topic der ersetzten Frage.
- Behebe den genannten Grund.

SPRACHE für Klasse ${grade}
- Höchstens ${style.stem} Wörter im Stamm.
- Höchstens ${style.option} Wörter in einer Option.
- Höchstens ${style.explanation} Wörter in einer Erklärung.
- Nur Wörter, die ein Kind der Klasse ${grade} kennt.
- Keine Fachsprache im Stamm: Denkfehler, Schluss, Prämisse, Umkehrung, zwingend, logisch.

${quizRules()}

QUIZ (JSON):
${JSON.stringify(quiz)}

MATERIAL (${content.length} Zeichen):
${content}

Ausgabe-Vertrag — halte ihn exakt ein:
${OUTPUT_CONTRACT.quiz}
`;
};

const flashcardsPrompt = (content: string, grade: number): string => {
  const style = gradeStyle(grade);
  return `
Erstelle 10 Karteikarten aus dem Material für Klasse ${grade}.

SPRACHE
- Style: ~80 % of the way to ASD-STE100: one thought per sentence; a verb over an abstract noun;
  active over passive; three or more items go vertical; cut, never decorate.
- Vorderseite: eine gezielte Frage in höchstens ${style.stem} Wörtern. Rückseite: eine knappe Antwort
  in höchstens ${style.explanation} Wörtern, in der Sprache eines Kindes der Klasse ${grade}.
- Nur Wörter, die ein Kind der Klasse ${grade} kennt. Ein Fachwort aus dem Material in einfachen
  Worten erklären.

Prinzip "Active Recall": Die Vorderseite fragt gezielt, die Rückseite erklärt knapp.

Ausgabe-Vertrag — halte ihn exakt ein:
${OUTPUT_CONTRACT.flashcards}

Material:
${content}
`;
};

const analysisPrompt = (history: string, grade: number): string => `
Du bist ein Lern-Coach für Klasse ${grade}. Analysiere die folgende Quiz-Performance. Finde nicht nur
Fehler, sondern Muster im Verständnis des Schülers.

SPRACHE
- Style: ~80 % of the way to ASD-STE100: one thought per sentence; a verb over an abstract noun;
  active over passive; three or more items go vertical; cut, never decorate.
- Jeder Satz höchstens ${gradeStyle(grade).text} Wörter, in der Sprache eines Kindes der
  Klasse ${grade}. Keine Fachsprache aus der Lerntheorie.

Performance-Daten:
${history}

Der Bericht benennt konkrete Stärken (strengths), spezifische Lernbereiche (growthAreas) und eine statistische Auswertung pro Thema (topicPerformance).

Ausgabe-Vertrag — halte ihn exakt ein:
${OUTPUT_CONTRACT.analysis}
`;

const topicPrompt = (topic: string, grade: number): string => {
  const style = gradeStyle(grade);
  return `
Du schreibst einen Lerntext zum Thema "${topic}" für Klasse ${grade}.

SPRACHE
- Style: ~80 % of the way to ASD-STE100: one thought per sentence; a verb over an abstract noun;
  active over passive; three or more items go vertical; cut, never decorate.
- Jeder Satz höchstens ${style.text} Wörter, in der Sprache eines Kindes der Klasse ${grade}.
- Nur Wörter, die ein Kind der Klasse ${grade} kennt. Ein Fachwort einmal in einfachen Worten erklären.
- Beispiele aus Schule, Familie, Spiel oder Sport.

AUFBAU
1. Einleitung: Warum ist das Thema wichtig?
2. Hauptteil mit klaren Überschriften, ohne jede Einzelheit zu verlieren.
3. Zusammenfassung mit den wichtigsten Punkten.

FORMAT: Markdown (Fettdruck, Listen, Tabellen wo sinnvoll).

Dieser Text ist die verlässliche Basis für Quizze und Karteikarten.
`;
};

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
  throw new Error(`Unbekannte Text-Variante: ${String(variant)}`);
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
        prompt: quizPrompt(asked, Number(input.grade) || 0, String(input.content ?? ""), previous, Boolean(input.hard)),
        isJson: true,
        targetCount: target,
      };
    }
    case "flashcards":
      return { prompt: flashcardsPrompt(String(input.content ?? ""), Number(input.grade) || 0), isJson: true, useFlashModel: true };
    case "analysis":
      return { prompt: analysisPrompt(JSON.stringify(input.history ?? []), Number(input.grade) || 0), isJson: true, useFlashModel: true };
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
