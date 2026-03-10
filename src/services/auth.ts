
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
  const headers = {
    ...options.headers,
    "x-user-id": userId,
  };

  return fetch(url, { ...options, headers });
};
