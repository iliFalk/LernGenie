
export const getUserId = (): string => {
  // 1. Try to get ID from Telegram Mini App
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.initDataUnsafe?.user?.id) {
    return `tg_${tg.initDataUnsafe.user.id}`;
  }

  // 2. Fallback to localStorage for browser testing
  let localId = localStorage.getItem("study_genie_user_id");
  if (!localId) {
    localId = `anon_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem("study_genie_user_id", localId);
  }
  return localId;
};

export const authFetch = (url: string, options: RequestInit = {}) => {
  const userId = getUserId();
  
  const headers: Record<string, string> = {
    ...Object.fromEntries(Object.entries(options.headers || {})),
    "x-user-id": userId,
  };

  // Include developer settings if present
  const isDevMode = localStorage.getItem("dev_mode_enabled") === "true";
  if (isDevMode) {
    const customKey = localStorage.getItem("custom_api_key");
    const aiProvider = localStorage.getItem("ai_provider");
    const aiModel = localStorage.getItem("ai_model");

    if (customKey) headers["x-ai-key"] = customKey;
    if (aiProvider) headers["x-ai-provider"] = aiProvider;
    if (aiModel) headers["x-ai-model"] = aiModel;
  }

  return fetch(url, { ...options, headers });
};
