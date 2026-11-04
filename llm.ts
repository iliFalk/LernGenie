import { randomBytes } from "node:crypto";
import { GoogleGenAI, Type } from "@google/genai";

const DEFAULT_GEMINI_MODEL = "gemini-3.1-pro-preview";
const DEFAULT_FLASH_MODEL = "gemini-3-flash-preview";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.0-flash-exp:free";

// CommandCode (https://api.commandcode.ai/provider/v1) speaks the OpenAI chat protocol.
const DEFAULT_COMMANDCODE_MODEL = "deepseek/deepseek-v4.1-flash";

// OpenCode Go (https://opencode.ai/zen/go/v1) speaks the OpenAI chat protocol too,
// but its model ids carry no organisation prefix.
const DEFAULT_OPENCODE_GO_MODEL = "deepseek-v4.1-flash";

/** OpenCode Go answers a chat request without a session header with 400 MissingSessionID,
 *  and its CDN answers 403 (error code 1010) when the request carries no User-Agent.
 *  The header set is built once per process. */
function openCodeGoHeaders(): Record<string, string> {
  const hex = randomBytes(6).toString("hex");
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const tail = Array.from(randomBytes(14), (b) => alphabet[b % alphabet.length]).join("");
  return {
    "User-Agent": "opencode/1.18.0",
    "x-opencode-session": `ses_${hex}${tail.slice(0, 14)}`,
  };
}

const OPENCODE_GO_HEADERS = openCodeGoHeaders();

/** OpenRouter reserves the whole output window when a call carries no `max_tokens`,
 *  and then rejects it with HTTP 402 on a small key limit. This is its bound. */
const DEFAULT_OPENROUTER_MAX_TOKENS = 8192;

export function sanitizeApiKey(key: string | undefined): string {
  if (!key) return "";
  let clean = key.trim();
  // Strip leading and trailing quotes if present
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.substring(1, clean.length - 1).trim();
  }
  return clean;
}

/**
 * Output budget for one model call.
 *
 * `LLM_MAX_TOKENS` wins when it holds a positive number. Without it the call carries
 * no `max_tokens` at all and the provider applies its own default — except on
 * OpenRouter, which reserves the model's full output window (up to 131072 tokens) and
 * rejects the call with HTTP 402 when the key limit is smaller. That path therefore
 * keeps a bounded default.
 */
export function resolveMaxTokens(provider: string, raw: string | undefined = process.env.LLM_MAX_TOKENS): number | undefined {
  const parsed = Number(raw);
  if (raw !== undefined && raw !== "" && Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  return provider === "openrouter" ? DEFAULT_OPENROUTER_MAX_TOKENS : undefined;
}

/** `LLM_REASONING_EFFORT` sets the model's thinking per deployment. `none` turns it off —
 *  measured on OpenCode Go with a small quiz prompt: 0 reasoning tokens and 1.7 s instead of
 *  5.1 s and 350 reasoning tokens. `low`/`medium`/`high` bound it, an unknown value is dropped.
 *  Empty sends no field, so the provider default applies. */
export function resolveReasoningEffort(raw: string | undefined = process.env.LLM_REASONING_EFFORT): string | undefined {
  const value = (raw || "").trim();
  return value === "" ? undefined : value;
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
  /** Per-request thinking budget. Wins over `LLM_REASONING_EFFORT`, so one route can ask for
   *  a harder run while the deployment default stays cheap. */
  reasoningEffort?: string;
}) {
  const { provider, apiKey, model, prompt, isJson, systemPrompt, imageData, useFlashModel, reasoningEffort } = params;
  const effort = reasoningEffort ?? resolveReasoningEffort();

  if (provider === "openrouter") {
    const cleanOpenRouterKey = sanitizeApiKey(apiKey) || sanitizeApiKey(process.env.OPENROUTER_API_KEY);
    return callChatCompletions({
      url: OPENROUTER_URL,
      label: "openrouter",
      apiKey: cleanOpenRouterKey,
      model: model || process.env.AI_MODEL || DEFAULT_OPENROUTER_MODEL,
      supportsJsonMode: true,
      reasoningEffort: effort,
      prompt, isJson, systemPrompt, imageData,
    });
  }

  if (provider === "commandcode") {
    const cleanCommandCodeKey = sanitizeApiKey(apiKey) || sanitizeApiKey(process.env.COMMANDCODE_API_KEY);
    const baseUrl = (process.env.COMMANDCODE_BASE_URL || "https://api.commandcode.ai/provider/v1").replace(/\/+$/, "");
    return callChatCompletions({
      url: `${baseUrl}/chat/completions`,
      label: "commandcode",
      apiKey: cleanCommandCodeKey,
      model: model || process.env.AI_MODEL || DEFAULT_COMMANDCODE_MODEL,
      // CommandCode rejects `response_format: json_object` with 400 "invalid request
      // error" as soon as the prompt grows. The wrapper reads the JSON out of the
      // answer and validates it, so the field is not needed here.
      supportsJsonMode: false,
      reasoningEffort: effort,
      prompt, isJson, systemPrompt, imageData,
    });
  }

  if (provider === "opencode-go" || provider === "opencode_go") {
    const cleanOpenCodeGoKey = sanitizeApiKey(apiKey) || sanitizeApiKey(process.env.OPENCODE_GO_API_KEY);
    const baseUrl = (process.env.OPENCODE_GO_BASE_URL || "https://opencode.ai/zen/go/v1").replace(/\/+$/, "");
    return callChatCompletions({
      url: `${baseUrl}/chat/completions`,
      label: "opencode-go",
      apiKey: cleanOpenCodeGoKey,
      model: model || process.env.AI_MODEL || DEFAULT_OPENCODE_GO_MODEL,
      supportsJsonMode: true,
      reasoningEffort: effort,
      prompt, isJson, systemPrompt, imageData,
    });
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

async function callChatCompletions(params: {
  url: string;
  label: string;
  apiKey?: string;
  model?: string;
  supportsJsonMode: boolean;
  reasoningEffort?: string;
  prompt: string;
  isJson?: boolean;
  systemPrompt?: string;
  imageData?: { data: string; mimeType: string };
}) {
  const { url, label, apiKey, model, supportsJsonMode, reasoningEffort, prompt, isJson, systemPrompt, imageData } = params;

  if (!apiKey) throw new Error(`${label} API Key is required`);

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

  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS || 180000);
  const maxTokens = resolveMaxTokens(label);
  console.log(
    `[llm] ${label} model=${model || "?"} json=${!!isJson} timeout=${timeoutMs}ms max_tokens=${maxTokens ?? "model default"} reasoning=${reasoningEffort ?? "provider default"}`,
  );

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (label === "openrouter") {
    // Only OpenRouter wants the referring app in the header.
    headers["HTTP-Referer"] = "https://ai.studio/build";
  }
  if (label === "opencode-go") {
    Object.assign(headers, OPENCODE_GO_HEADERS);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        model: model,
        messages: messages,
        // A bounded answer keeps latency and cost predictable. The value is absent
        // when no limit is configured and the provider's default applies.
        max_tokens: maxTokens,
        reasoning_effort: reasoningEffort,
        response_format: isJson && supportsJsonMode ? { type: "json_object" } : undefined,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: any) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error(
        `Zeitüberschreitung: Das Modell ${model || ""} hat nicht innerhalb von ${Math.round(timeoutMs / 1000)} s geantwortet. Bitte erneut versuchen oder im Developer Mode ein anderes Modell wählen.`
      );
    }
    throw error;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`${label} error: ${response.status} ${errorBody}`);
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
