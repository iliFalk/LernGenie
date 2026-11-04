/**
 * Mechanical quality checks for a generated quiz.
 *
 * The prompt asks for plausible, equally long, misconception-based options; a
 * prompt is a request, not a guarantee. Measured on the live deployment before
 * these checks existed: every option list used the full length range (4 to 120
 * characters) and the correct option was up to 93 characters longer than the
 * longest distractor, so the answer was readable from its length alone.
 *
 * A finding is **hard** or **soft**, and only hard findings pay for a repair call.
 * Hard means the exercise is broken or misleading: a missing answer, an invented
 * option, a negation, a duplicate, a compound stem. Soft means the style drifted:
 * uneven lengths, a long correct option, a thin justification, an unbalanced set.
 * Repairing the soft ones costs another full model call (~120-180 s measured) for a
 * cosmetic gain, so they are logged instead.
 *
 * These checks are pure functions over the normalised quiz, so the gateway can run
 * them before and after a repair pass and a test can pin each finding.
 */

import { questionKey, type QuizQuestion } from "../contracts/quiz";
import { gradeStyle } from "./prompts";

/** An option that opens with a negation tells the pupil what is wrong, not what is right. */
const NEGATION_OPENING = /^\s*(ohne|nicht|kein|keine|keinen|keiner|niemals|nie|weder)\b/i;

/**
 * Words from the vocabulary of logic and didactics. A pupil in Klasse 5 or 6 cannot read
 * them; the prompt therefore bans them and this check catches the drift. A term quoted
 * from the material is the one exception the model may use, so the check runs on the
 * task text, not on the source.
 */
const META_TERMS = [
  "Denkfehler",
  "Schluss",
  "Prämisse",
  "Umkehrung",
  "Verallgemeinerung",
  "Zirkel",
  "Analogie",
  "Begriffsvertauschung",
  "zwingend",
  "logisch",
];

const META_PATTERNS = META_TERMS.map((term) => ({ term, pattern: new RegExp(`\\b${term}\\b`, "i") }));

const metaTermIn = (text: string): string | undefined =>
  META_PATTERNS.find(({ pattern }) => pattern.test(text))?.term;

const countWords = (text: string): number => (text.match(/[\wÄÖÜäöüß-]+/g) ?? []).length;

/** The type names that belong to each of the three modules the prompt asks for. */
const MODULE_TYPES: Record<"begriffe" | "schluesse" | "fangfragen", string[]> = {
  begriffe: ["BEZIEHUNG", "WIEDERGEBEN"],
  schluesse: ["FOLGERUNG", "AUSSCHLUSS"],
  fangfragen: ["FEHLER", "GRUND/FOLGE"],
};

/** The content words of a text: long enough to carry meaning, case dropped. */
const words = (text: string): string[] => (text.match(/[\wÄÖÜäöüß]+/g) ?? []).filter((word) => word.length >= 6);

export interface QuizCheckResult {
  /** All findings per question number (1-based). Empty means the question passed. */
  items: Record<number, string[]>;
  /** Findings that justify a repair call, per question number. */
  hardItems: Record<number, string[]>;
  /** Findings about the set as a whole; all of them are soft. */
  global: string[];
  /** Number of questions with at least one hard finding. Only these are repaired. */
  flagged: number;
  /** Number of questions with soft findings only. They are logged, not repaired. */
  soft: number;
}

export interface QuizCheckOptions {
  /** The material the quiz was built from; used for the "option outside the material" check. */
  source: string;
  /** Target grade. Turns the class label into word limits per stem and option. */
  grade?: number;
  /** A quiz must not be pure recall. */
  maxRecallShare?: number;
  /** A quiz needs all three modules. */
  minModules?: number;
  /** Justifications per option are expected. */
  expectRationales?: boolean;
}

const isRecall = (type: string): boolean => /wiedergeb/i.test(type);

/** Type names that mark a recall question when the model leaves `type` empty. */
const recallStem = /^(was|wo|wer|wann|wie viele)\b/i;

/**
 * Finds the questions the prompt's own rules should have prevented. The findings are
 * split by severity: hard (repair) and soft (log only).
 */
export function checkQuiz(quiz: QuizQuestion[], options: QuizCheckOptions): QuizCheckResult {
  const source = new Set(words(options.source).map((word) => word.toLowerCase()));
  const style = gradeStyle(options.grade ?? 0);
  const gradeLabel = options.grade && options.grade > 0 ? String(options.grade) : "?";
  const maxRecallShare = options.maxRecallShare ?? 0.4;
  const minModules = options.minModules ?? 3;
  const expectRationales = options.expectRationales ?? true;

  const items: Record<number, string[]> = {};
  const hardItems: Record<number, string[]> = {};
  let softCount = 0;

  quiz.forEach((question, index) => {
    const number = index + 1;
    const hard: string[] = [];
    const soft: string[] = [];
    const { options: list, correctIndex, optionRationales } = question;
    const lengths = list.map((option) => option.length);

    // Hard: the exercise itself is broken or would teach the wrong thing.
    if (list.length !== 4) hard.push("nicht genau vier Optionen");
    if (correctIndex < 0 || correctIndex >= list.length) hard.push("keine gültige richtige Antwort");
    if (!question.type.trim()) hard.push("kein Aufgabentyp (type)");
    if (!question.topic.trim()) hard.push("kein topic");
    if (list.some((option) => NEGATION_OPENING.test(option))) hard.push("Option beginnt mit einer Verneinung");
    if (new Set(list.map((option) => questionKey(option))).size < list.length) hard.push("doppelte Option");

    // Grade fit. A stem twice as long as the band allows cannot be read by a pupil of
    // that class, so it is hard; a single over-long option is style and stays soft.
    const stemWords = countWords(question.text);
    if (stemWords > style.stem * 2) {
      hard.push(`Stamm zu lang für Klasse ${gradeLabel}: ${stemWords} Wörter, Grenze ${style.stem}`);
    } else if (stemWords > style.stem) {
      soft.push(`Stamm über der Grenze für Klasse ${gradeLabel}: ${stemWords} Wörter, Grenze ${style.stem}`);
    }
    const stemMeta = metaTermIn(question.text);
    if (stemMeta) hard.push(`Fachsprache im Stamm: "${stemMeta}"`);
    list.forEach((option, position) => {
      const optionWords = countWords(option);
      if (optionWords > style.option) soft.push(`Option ${position + 1} über der Grenze: ${optionWords} Wörter, Grenze ${style.option}`);
      const optionMeta = metaTermIn(option);
      if (optionMeta) soft.push(`Option ${position + 1} nennt Fachsprache: "${optionMeta}"`);
    });

    // Soft, not hard: a plausible distractor is a misconception the material does NOT
    // contain verbatim, so a missing lexical anchor is a style signal, not a defect.
    // Measured: as a hard rule this flagged the intended distractors and forced a
    // repair pass (120-180 s) on almost every generation.
    if (source.size > 0) {
      const foreign = list.findIndex((option, i) => {
        if (i === correctIndex) return false;
        const wordsInOption = words(option).map((word) => word.toLowerCase());
        return wordsInOption.length > 0 && !wordsInOption.some((word) => source.has(word));
      });
      if (foreign !== -1) soft.push(`Option ${foreign + 1} hat keinen Wortanker im Material`);
    }

    // Soft: the style drifted, the exercise still works.
    if (lengths.length > 0 && Math.max(...lengths) > 0) {
      const spread = (Math.max(...lengths) - Math.min(...lengths)) / Math.max(...lengths);
      if (spread > 0.35) soft.push(`Optionslängen streuen um ${Math.round(spread * 100)} %`);
    }

    if (correctIndex >= 0 && correctIndex < list.length) {
      const others = lengths.filter((_, i) => i !== correctIndex);
      if (others.length > 0 && Math.max(...others) > 0 && lengths[correctIndex] > Math.max(...others) * 1.25) {
        soft.push("richtige Option ist deutlich länger als jede falsche");
      }
    }

    if (recallStem.test(question.text.trim()) && question.type.trim() && !isRecall(question.type)) {
      soft.push("Stamm klingt nach Abfragen, der Typ nennt eine Denkoperation");
    }

    // Soft: two question marks in a stem usually quote a question, they do not mean the
    // stem asks two things. Measured: as a hard rule this alone triggered a 150 s repair.
    if ((question.text.match(/\?/g) ?? []).length > 1) soft.push("Stamm enthält zwei Fragezeichen");
    if (expectRationales && optionRationales.length === list.length) {
      const missing = optionRationales.filter((text) => !text.trim()).length;
      if (missing > 0) soft.push(`${missing} Option(en) ohne Begründung`);
      // The prompt caps a rationale at 8 words. The display and the runtime depend on it, so
      // the log must show the drift; the limit is the same number in both places.
      const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
      const tooLong = optionRationales.filter((text) => text.trim() && words(text) > 8).length;
      if (tooLong > 0) soft.push(`${tooLong} Begründung(en) länger als 8 Wörter`);
    }

    // The explanation carries the same word limit as the prompt states for the grade.
    // Twice the limit cannot be read by the pupil, so it is repaired; one step over is style.
    const explanationWords = countWords(question.explanation);
    if (question.explanation.trim() && explanationWords > style.explanation * 2) {
      hard.push(`Erklärung doppelt so lang wie die Grenze: ${explanationWords} Wörter, Grenze ${style.explanation}`);
    } else if (question.explanation.trim() && explanationWords > style.explanation) {
      soft.push(`Erklärung über der Grenze: ${explanationWords} Wörter, Grenze ${style.explanation}`);
    }

    const found = [...hard, ...soft];
    if (found.length > 0) items[number] = found;
    if (hard.length > 0) hardItems[number] = hard;
    else if (soft.length > 0) softCount += 1;
  });

  const global: string[] = [];
  // The prompt asks for three modules, not three type names: a set can carry three types
  // inside one module and still miss the mix. Count the modules.
  const moduleOf = (type: string): string => {
    const name = type.trim().toUpperCase();
    if (MODULE_TYPES.begriffe.includes(name)) return "BEGRIFFE";
    if (MODULE_TYPES.schluesse.includes(name)) return "SCHLÜSSE";
    if (MODULE_TYPES.fangfragen.includes(name)) return "FANGFRAGE";
    return "SONSTIGE";
  };
  const modules = new Set(quiz.map((question) => moduleOf(question.type)));
  if (modules.size < minModules) {
    global.push(`nur ${modules.size} von 3 Modulen vertreten (${[...modules].join(", ")})`);
  }
  const recall = quiz.filter(
    (question) => isRecall(question.type) || (!question.type.trim() && recallStem.test(question.text)),
  ).length;
  if (quiz.length > 0 && recall / quiz.length > maxRecallShare) {
    global.push(`${recall} von ${quiz.length} Fragen sind reines Abfragen`);
  }
  const stems = quiz.map((question) => countWords(question.text));
  const averageStem = stems.reduce((sum, value) => sum + value, 0) / Math.max(1, stems.length);
  if (averageStem > style.stem) {
    global.push(`Stämme im Schnitt ${averageStem.toFixed(1)} Wörter, Grenze für Klasse ${gradeLabel} ${style.stem}`);
  }

  return { items, hardItems, global, flagged: Object.keys(hardItems).length, soft: softCount };
}

/**
 * The hard findings as readable lines, for the repair prompt. Soft findings stay out:
 * a question is only rewritten when its exercise is broken, not when it is uneven.
 */
export function formatQuizFlags(quiz: QuizQuestion[], flags: QuizCheckResult): string {
  const lines = Object.entries(flags.hardItems).map(([number, reasons]) => {
    const question = quiz[Number(number) - 1];
    return `- Frage ${number} ("${question ? question.text.slice(0, 70) : "?"}"): ${reasons.join("; ")}`;
  });
  return lines.join("\n");
}

/** One line for the container log: what was found, how much of it is hard. */
export function summariseQuizFlags(flags: QuizCheckResult): string {
  const softOnly = Object.entries(flags.items)
    .filter(([number]) => !flags.hardItems[Number(number)])
    .map(([number, reasons]) => `Frage ${number}: ${reasons.join("; ")}`);
  const parts = [
    `${flags.flagged} harte Beanstandung(en)`,
    `${flags.soft} weiche`,
  ];
  if (flags.global.length > 0) parts.push(`Set: ${flags.global.join("; ")}`);
  const hardDetail = Object.entries(flags.hardItems).map(
    ([number, reasons]) => `hart ${number}: ${reasons.join("; ")}`,
  );
  if (hardDetail.length > 0) parts.push(hardDetail.join(" | ").slice(0, 300));
  if (softOnly.length > 0) parts.push(`weich: ${softOnly.join(" | ").slice(0, 200)}`);
  return parts.join(" · ");
}
