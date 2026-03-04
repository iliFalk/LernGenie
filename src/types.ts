export interface StudyPackage {
  id: string;
  name: string;
  grade: number;
  created_at?: string;
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
  text: string;
  options: string[];
  correctIndex: number;
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
