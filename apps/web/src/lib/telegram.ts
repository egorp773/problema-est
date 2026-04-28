export type TelegramUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
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

export function getTelegramUser(): TelegramUser | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
}

export async function waitForTelegramUser(timeoutMs = 1200): Promise<TelegramUser | null> {
  if (typeof window === "undefined") return null;

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const user = getTelegramUser();
    if (user?.id || user?.first_name || user?.username || user?.photo_url) return user;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  return getTelegramUser();
}

export function getTelegramDisplayName(user: TelegramUser | null) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return name || "Пользователь";
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
