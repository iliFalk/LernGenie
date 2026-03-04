import { GoogleGenAI, Type } from "@google/genai";
import { Question, AnalysisData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function extractTextFromImage(base64Data: string, mimeType: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash", // Using flash for fast OCR
    contents: [
      {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: "Extrahiere den gesamten Text aus diesem Bild. Wenn es sich um handgeschriebene Notizen handelt, transkribiere sie so genau wie möglich. Gib nur den extrahierten Text zurück." }
        ]
      }
    ]
  });
  return response.text || "";
}

export async function generateQuiz(content: string, grade: number, count: number = 10): Promise<Question[]> {
  const response = await ai.models.generateContent({
    model: "gemini-1.5-pro", // Pro for better reasoning/quality
    contents: `Analysiere das folgende Lernmaterial und erstelle ein Quiz mit ${count} Multiple-Choice-Fragen für die Klassenstufe ${grade}.
    
    WICHTIGE REGELN:
    1. Alle Fragen MÜSSEN ausschließlich auf dem bereitgestellten Inhalt basieren.
    2. Die Sprache muss für Klassenstufe ${grade} angemessen sein.
    3. Jede Frage braucht:
       - Einen hilfreichen Hinweis (Hint), der den Nutzer zum Nachdenken anregt, ohne die Lösung direkt zu verraten.
       - Eine detaillierte Erklärung, warum die richtige Antwort korrekt ist, basierend auf dem Material.
       - Ein Thema (Topic), zu dem die Frage gehört.
    
    Material:
    ${content}`,
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
    model: "gemini-1.5-flash",
    contents: `Analysiere die folgende Quiz-Performance und gib Stärken, Lernbereiche und eine Themen-Statistik zurück.
    
    Performance:
    ${JSON.stringify(history)}`,
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
    model: "gemini-1.5-flash",
    contents: `Erstelle 10 Karteikarten (Flashcards) aus dem folgenden Material.
    Material: ${content}`,
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
    model: "gemini-1.5-flash",
    contents: `Erstelle eine strukturierte Zusammenfassung (Study Guide) des folgenden Materials in Markdown-Format.
    Material: ${content}`
  });
  return response.text || "";
}
