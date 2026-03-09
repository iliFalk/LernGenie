/**
 * Centralized prompts for the AI services.
 * These prompts are designed to emulate the "NotebookLM" feel:
 * - Deeply analytical
 * - Explanatory and pedagogical
 * - Highly structured
 * - Grounded and source-oriented
 */

export const OCR_PROMPT = "Extrahiere den gesamten Text aus diesem Bild. Wenn es sich um handgeschriebene Notizen handelt, transkribiere sie so genau wie möglich. Gib nur den extrahierten Text zurück.";

export const QUIZ_PROMPT = (count: number, grade: number, content: string) => `
Du bist ein pädagogischer Experte, spezialisiert auf tiefgehendes Verständnis (ähnlich wie NotebookLM). 
Analysiere das folgende Lernmaterial und erstelle ein Quiz mit ${count} Multiple-Choice-Fragen für die Klassenstufe ${grade}.

WICHTIGE REGELN:
1. QUELLENTREUE: Alle Fragen MÜSSEN ausschließlich auf dem bereitgestellten Inhalt basieren. Erfinde keine Fakten hinzu.
2. DIDAKTIK: Die Sprache muss für Klassenstufe ${grade} angemessen, aber intellektuell anregend sein.
3. STRUKTUR: Jede Frage braucht:
   - Einen hilfreichen Hinweis (Hint), der den Nutzer zum Nachdenken anregt (Sokratische Methode), ohne die Lösung direkt zu verraten.
   - Eine detaillierte Erklärung (Explanation), die nicht nur sagt "Das ist richtig", sondern den Kontext im Material erläutert (Warum ist das so? Wie hängt es zusammen?).
   - Ein Thema (Topic), zu dem die Frage gehört.

Material:
${content}
`;

export const PERFORMANCE_ANALYSIS_PROMPT = (history: string) => `
Du bist ein persönlicher Lern-Coach. Analysiere die folgende Quiz-Performance mit der Präzision von NotebookLM. 
Identifiziere nicht nur Fehler, sondern Muster im Verständnis des Schülers.

Performance-Daten:
${history}

Gib eine Analyse zurück, die:
1. Konkrete Stärken (Strengths) benennt.
2. Spezifische Lernbereiche (Growth Areas) aufzeigt, wo Konzepte missverstanden wurden.
3. Eine statistische Auswertung pro Thema liefert.
`;

export const FLASHCARDS_PROMPT = (content: string) => `
Erstelle 10 hochwertige Karteikarten (Flashcards) aus dem folgenden Material. 
Folge dem Prinzip des "Active Recall". Die Vorderseite sollte eine gezielte Frage oder ein Konzept sein, 
die Rückseite eine prägnante, erklärende Antwort im Stil eines Experten-Tutors.

Material:
${content}
`;

export const STUDY_GUIDE_PROMPT = (content: string) => `
Du bist ein KI-Studienassistent (NotebookLM-Stil). Erstelle einen umfassenden, strukturierten Study Guide aus dem folgenden Material.

STRUKTUR DES GUIDES:
1. EXEKUTIVE ZUSAMMENFASSUNG: Der Kern des Themas in 3 Sätzen.
2. SCHLÜSSELKONZEPTE: Detaillierte Erläuterung der wichtigsten Begriffe.
3. DEEP DIVE: Analyse von Zusammenhängen und "Warum"-Fragen.
4. SCHNELL-CHECK: 5 Kernpunkte zum Merken.

Verwende Markdown für eine klare Hierarchie.
Material:
${content}
`;

export const TOPIC_GENERATION_PROMPT = (topic: string, grade: number) => `
Du bist ein Wissens-Kurator (NotebookLM-Stil). Erstelle eine umfassende "Source of Truth" zum Thema "${topic}" für die Klassenstufe ${grade}.

DEIN AUFTRAG:
Erstelle einen Text, der sich anfühlt wie ein perfekt recherchiertes Kapitel eines modernen, digitalen Lehrbuchs.

ANFORDERUNGEN:
1. KLARHEIT: Nutze eine Sprache, die für Klassenstufe ${grade} verständlich ist, aber keine Details auslässt.
2. STRUKTUR:
   - Einleitung: Warum ist dieses Thema wichtig?
   - Hauptteil: Unterteilt in logische Abschnitte mit klaren Überschriften.
   - Beispiele: Nutze Analogien und Beispiele aus der Lebenswelt der Schüler.
   - Zusammenfassung: Die wichtigsten Take-aways.
3. FORMAT: Nutze Markdown (Fettdruck, Listen, Tabellen wo sinnvoll).

Schreibe so, dass dieser Text als verlässliche Basis für alle weiteren Lernaktivitäten (Quizze, Karten) dienen kann.
`;
