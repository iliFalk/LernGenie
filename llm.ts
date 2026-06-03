import { GoogleGenAI, Type } from "@google/genai";

const DEFAULT_GEMINI_MODEL = "gemini-3.1-pro-preview";
const DEFAULT_FLASH_MODEL = "gemini-3-flash-preview";

export function sanitizeApiKey(key: string | undefined): string {
  if (!key) return "";
  let clean = key.trim();
  // Strip leading and trailing quotes if present
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.substring(1, clean.length - 1).trim();
  }
  return clean;
}

export async function callLLM(params: {
  provider: string;
  apiKey?: string;
  model?: string;
  prompt: string;
  isJson?: boolean;
  systemPrompt?: string;
  imageData?: { data: string; mimeType: string };
  useFlashModel?: boolean;
}) {
  const { provider, apiKey, model, prompt, isJson, systemPrompt, imageData, useFlashModel } = params;

  if (provider === "openrouter") {
    const cleanOpenRouterKey = sanitizeApiKey(apiKey);
    return callOpenRouter(cleanOpenRouterKey, model || "google/gemini-2.0-flash-exp:free", prompt, isJson, systemPrompt, imageData);
  }

  // Fallback to Gemini
  const fallbackModel = useFlashModel ? DEFAULT_FLASH_MODEL : DEFAULT_GEMINI_MODEL;
  
  // Resolve and clean Gemini API Key
  let resolvedKey = sanitizeApiKey(apiKey);
  if (!resolvedKey || resolvedKey === "undefined" || resolvedKey === "null" || resolvedKey === "MY_GEMINI_API_KEY") {
    resolvedKey = sanitizeApiKey(process.env.GEMINI_API_KEY);
  }

  if (!resolvedKey || resolvedKey === "MY_GEMINI_API_KEY") {
    throw new Error(
      "Fehler: Kein gültiger Gemini API-Key konfiguriert. Bitte trage deinen API-Key in den Einstellungen der App (Developer Mode) ein, oder setze die Umgebungsvariable GEMINI_API_KEY."
    );
  }

  return callGemini(resolvedKey, model || fallbackModel, prompt, isJson, systemPrompt, imageData);
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
  // Use recommended setting from gemini-api skill: set User-Agent to 'aistudio-build'
  const genAI = new GoogleGenAI({ 
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
  
  const parts: any[] = [];
  if (imageData) {
    parts.push({
      inlineData: {
        data: imageData.data,
        mimeType: imageData.mimeType
      }
    });
  }
  parts.push({ text: prompt });

  try {
    const response = await genAI.models.generateContent({
      model: model,
      contents: [{ role: "user", parts: parts }],
      config: {
        systemInstruction: systemPrompt || undefined,
        responseMimeType: isJson ? "application/json" : undefined,
      }
    });

    return response.text || "";
  } catch (error: any) {
    const errorMsg = String(error.message || error);
    const isModelOrQuotaError = 
      errorMsg.includes("not found") || 
      errorMsg.includes("Unsupported") || 
      errorMsg.includes("capability") || 
      errorMsg.includes("model") ||
      errorMsg.includes("404") ||
      errorMsg.includes("400");
    
    // Automatically fallback to general compatible stable models if the specified model is unsupported or not found
    if (isModelOrQuotaError && model !== "gemini-3.5-flash" && model !== "gemini-2.5-flash-image") {
      const fallbackModel = imageData ? "gemini-2.5-flash-image" : "gemini-3.5-flash";
      console.warn(`[Gemini Fallback] Model ${model} failed. Retrying with fallback model: ${fallbackModel}. Error: ${errorMsg}`);
      
      try {
        const response = await genAI.models.generateContent({
          model: fallbackModel,
          contents: [{ role: "user", parts: parts }],
          config: {
            systemInstruction: systemPrompt || undefined,
            responseMimeType: isJson ? "application/json" : undefined,
          }
        });
        return response.text || "";
      } catch (fallbackError) {
        // If secondary fallback also fails, throw original or fallback error
        throw fallbackError;
      }
    }
    throw error;
  }
}
