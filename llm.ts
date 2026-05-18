import { GoogleGenAI, Type } from "@google/genai";

const DEFAULT_GEMINI_MODEL = "gemini-3.1-pro-preview";
const DEFAULT_FLASH_MODEL = "gemini-3-flash-preview";

export async function callLLM(params: {
  provider: string;
  apiKey?: string;
  model?: string;
  prompt: string;
  isJson?: boolean;
  systemPrompt?: string;
  imageData?: { data: string; mimeType: string };
}) {
  const { provider, apiKey, model, prompt, isJson, systemPrompt, imageData } = params;

  if (provider === "openrouter") {
    return callOpenRouter(apiKey, model || "google/gemini-2.0-flash-exp:free", prompt, isJson, systemPrompt, imageData);
  }

  // Fallback to Gemini
  return callGemini(apiKey || process.env.GEMINI_API_KEY || "", model || DEFAULT_GEMINI_MODEL, prompt, isJson, systemPrompt, imageData);
}

async function callOpenRouter(apiKey?: string, model?: string, prompt?: string, isJson?: boolean, systemPrompt?: string, imageData?: { data: string; mimeType: string }) {
  if (!apiKey) throw new Error("OpenRouter API Key is required");

  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  const userContent: any[] = [{ type: "text", text: prompt }];
  if (imageData) {
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:${imageData.mimeType};base64,${imageData.data}`
      }
    });
  }

  messages.push({ role: "user", content: userContent });

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ai.studio/build",
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      response_format: isJson ? { type: "json_object" } : undefined,
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter error: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGemini(apiKey: string, model: string, prompt: string, isJson: boolean, systemPrompt?: string, imageData?: { data: string; mimeType: string }) {
  const genAI = new GoogleGenAI({ apiKey });
  
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  const parts: any[] = [{ text: fullPrompt }];

  if (imageData) {
    parts.push({
      inlineData: {
        data: imageData.data,
        mimeType: imageData.mimeType
      }
    });
  }

  const response = await genAI.models.generateContent({
    model: model,
    contents: [{ role: "user", parts: parts }],
    config: isJson ? { responseMimeType: "application/json" } : undefined,
  });

  return response.text || "";
}
