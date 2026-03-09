import { GoogleGenAI, Type } from "@google/genai";
import { Question, AnalysisData } from "../types";
import * as Prompts from "../prompts";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function extractTextFromImage(base64Data: string, mimeType: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview", // Using flash for fast OCR
    contents: [
      {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: Prompts.OCR_PROMPT }
        ]
      }
    ]
  });
  return response.text || "";
}

export async function generateQuiz(content: string, grade: number, count: number = 10): Promise<Question[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview", // Pro for better reasoning/quality
    contents: Prompts.QUIZ_PROMPT(count, grade, content),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctIndex: { type: Type.INTEGER },
            hint: { type: Type.STRING },
            explanation: { type: Type.STRING },
            topic: { type: Type.STRING }
          },
          required: ["id", "text", "options", "correctIndex", "hint", "explanation", "topic"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse quiz JSON", e);
    return [];
  }
}

export async function analyzePerformance(results: { question: Question; isCorrect: boolean }[]): Promise<AnalysisData> {
  const history = results.map(r => ({
    topic: r.question.topic,
    isCorrect: r.isCorrect,
    question: r.question.text
  }));

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: Prompts.PERFORMANCE_ANALYSIS_PROMPT(JSON.stringify(history)),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          growthAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
          topicPerformance: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                score: { type: Type.INTEGER },
                total: { type: Type.INTEGER }
              }
            }
          }
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { strengths: [], growthAreas: [], topicPerformance: [] };
  }
}

export async function generateFlashcards(content: string): Promise<{ front: string; back: string }[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: Prompts.FLASHCARDS_PROMPT(content),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            front: { type: Type.STRING },
            back: { type: Type.STRING }
          }
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
}

export async function generateStudyGuide(content: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: Prompts.STUDY_GUIDE_PROMPT(content)
  });
  return response.text || "";
}

export async function generateTopicContent(topic: string, grade: number): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: Prompts.TOPIC_GENERATION_PROMPT(topic, grade)
  });
  return response.text || "";
}
