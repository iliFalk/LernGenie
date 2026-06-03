import { Question, AnalysisData } from "../types";
import { authFetch } from "./auth";

async function handleResponse(response: Response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }
  return response.json();
}

export async function extractTextFromImage(base64Data: string, mimeType: string): Promise<string> {
  const response = await authFetch("/api/ai/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Data, mimeType }),
  });
  const data = await handleResponse(response);
  return data.text || "";
}

export async function generateQuiz(content: string, grade: number, count: number = 10): Promise<Question[]> {
  const response = await authFetch("/api/ai/quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, grade, count }),
  });
  return await handleResponse(response);
}

export async function getCachedQuiz(packageId: string, regenerate: boolean = false): Promise<Question[]> {
  const response = await authFetch(`/api/packages/${packageId}/quiz${regenerate ? "?regenerate=true" : ""}`);
  return await handleResponse(response);
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
  return await handleResponse(response);
}

export async function generateFlashcards(content: string): Promise<{ front: string; back: string }[]> {
  const response = await authFetch("/api/ai/flashcards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return await handleResponse(response);
}

export async function getCachedFlashcards(packageId: string, regenerate: boolean = false): Promise<{ front: string; back: string }[]> {
  const response = await authFetch(`/api/packages/${packageId}/flashcards${regenerate ? "?regenerate=true" : ""}`);
  return await handleResponse(response);
}

export async function generateStudyGuide(content: string): Promise<string> {
  const response = await authFetch("/api/ai/study-guide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const data = await handleResponse(response);
  return data.text || "";
}

export async function getCachedStudyGuide(packageId: string, regenerate: boolean = false): Promise<string> {
  const response = await authFetch(`/api/packages/${packageId}/study-guide${regenerate ? "?regenerate=true" : ""}`);
  const data = await handleResponse(response);
  return data.text || "";
}

export async function generateTopicContent(topic: string, grade: number): Promise<string> {
  const response = await authFetch("/api/ai/topic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, grade }),
  });
  const data = await handleResponse(response);
  return data.text || "";
}

