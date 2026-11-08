export interface StudyPackage {
  id: string;
  name: string;
  grade: number;
  created_at?: string;
  subject?: string;
  /** The user's own wish about the questions. Empty means no wish block in the prompt. */
  quiz_notes?: string | null;
}

export interface Material {
  id: string;
  package_id: string;
  name: string;
  content_text?: string;
  mime_type?: string;
}

export interface Question {
  id: string;
  /** Thinking operation of the question: WIEDERGEBEN, BEZIEHUNG, AUSSCHLUSS, FOLGERUNG, FEHLER … */
  type?: string;
  text: string;
  options: string[];
  correctIndex: number;
  /** One justification per option, aligned with `options`. */
  optionRationales?: string[];
  hint: string;
  explanation: string;
  topic: string;
}

export interface QuizResult {
  id: string;
  package_id: string;
  score: number;
  total: number;
  accuracy: number;
  analysis: string; // JSON string of strengths/growth areas
  created_at?: string;
}

export interface AnalysisData {
  strengths: string[];
  growthAreas: string[];
  topicPerformance: { topic: string; score: number; total: number }[];
}
