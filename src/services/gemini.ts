import { Question, AnalysisData } from "../types";
import { authFetch } from "./auth";

export async function extractTextFromImage(base64Data: string, mimeType: string): Promise<string> {
  const response = await authFetch("/api/ai/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Data, mimeType }),
  });
  const data = await response.json();
  return data.text || "";
}

export async function generateQuiz(content: string, grade: number, count: number = 10): Promise<Question[]> {
  const response = await authFetch("/api/ai/quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, grade, count }),
  });
  return await response.json();
}

export async function analyzePerformance(results: { question: Question; isCorrect: boolean }[]): Promise<AnalysisData> {
  const history = results.map(r => ({
    topic: r.question.topic,
    isCorrect: r.isCorrect,
    question: r.question.text
  }));

  const response = await authFetch("/api/ai/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history }),
  });
  return await response.json();
}

export async function generateFlashcards(content: string): Promise<{ front: string; back: string }[]> {
  const response = await authFetch("/api/ai/flashcards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return await response.json();
}

export async function generateStudyGuide(content: string): Promise<string> {
  const response = await authFetch("/api/ai/study-guide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const data = await response.json();
  return data.text || "";
}

export async function generateTopicContent(topic: string, grade: number): Promise<string> {
  const response = await authFetch("/api/ai/topic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, grade }),
  });
  const data = await response.json();
  return data.text || "";
}
