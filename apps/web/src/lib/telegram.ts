export type TelegramUser = {
  id?: number;
  first_name?: string;
  username?: string;
};

export type TelegramWebApp = {
  initDataUnsafe?: {
    user?: TelegramUser;
  };
  ready?: () => void;
  expand?: () => void;
  openTelegramLink?: (url: string) => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function getTelegramUserId(): string | null {
  if (typeof window === "undefined") return null;
  const id = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  return id ? String(id) : null;
}

export function ensureAnonymousKey(): string {
  const key = "problema_est_anonymous_key";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(key, created);
  return created;
}

export function getTelegramShareUrl(text: string) {
  return `https://t.me/share/url?url=&text=${encodeURIComponent(text)}`;
}
