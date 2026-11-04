import { buildPrompt, quizRepairPrompt, subjectClassificationPrompt } from "../src/ai/prompts";

const MATERIAL =
  "Photosynthese: Chloroplasten enthalten Chlorophyll. Licht, Wasser und CO2 werden zu Glukose und O2. " +
  "Die Lichtreaktion liefert ATP und NADPH, der Calvin-Zyklus baut daraus Zucker.";

const show = (title: string, text: string) => {
  console.log(`\n===== ${title} (${text.length} Zeichen) =====`);
  console.log(text);
};

show("QUIZ standard, Klasse 6, 10 Fragen", buildPrompt("quiz", { content: MATERIAL, grade: 6, count: 10 }).prompt);
const hard = buildPrompt("quiz", { content: MATERIAL, grade: 6, count: 10, hard: true }).prompt;
const soft = buildPrompt("quiz", { content: MATERIAL, grade: 6, count: 10 }).prompt;
const hardBlock = hard.slice(soft.indexOf("3. FANGFRAGE"), hard.indexOf("REGELN"));
show("ZUSATZ beim Haken „Schwerere Fragen“", hardBlock);
show("QUIZ mit Ausschlussliste (Neu-Erzeugen)", buildPrompt("quiz", { content: MATERIAL, grade: 6, count: 5, previous: ["Was ist Chlorophyll?", "Was liefert die Lichtreaktion?"] }).prompt);
show(
  "REPARATUR nach harter Beanstandung",
  quizRepairPrompt(
    [{ id: "q1", type: "BEZIEHUNG", text: "Was gehört zusammen?", options: ["Licht", "ATP", "Zucker", "Chlorophyll"], correctIndex: 0, optionRationales: ["", "", "", ""], hint: "", explanation: "", topic: "" }],
    '- Frage 1 ("Was gehört zusammen?"): Option beginnt mit einer Verneinung',
    MATERIAL,
    6,
  ),
);
show("KARTEIKARTEN, Klasse 6", buildPrompt("flashcards", { content: MATERIAL, grade: 6 }).prompt);
show("AUSWERTUNG, Klasse 6", buildPrompt("analysis", { history: [{ topic: "Photosynthese", isCorrect: true, question: "Was ist Chlorophyll?" }], grade: 6 }).prompt);
show("THEMA (KI-Synthese), Klasse 6", buildPrompt("text", { variant: "topic", topic: "Photosynthese", grade: 6 }).prompt);
show("OCR", buildPrompt("text", { variant: "ocr", image: { data: "", mimeType: "image/png" } }).prompt);
show("FACH-ZUORDNUNG (Hilfsaufruf)", subjectClassificationPrompt("Mathe Test Brüche", ""));
