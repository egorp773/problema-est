export const CATEGORIES = [
  "ЖКХ",
  "дороги",
  "транспорт",
  "экология",
  "животные",
  "работа и доходы",
  "образование",
  "медицина",
  "интернет и связь",
  "сервисы и компании",
  "другое"
] as const;

export const PUBLIC_STATUSES = [
  "published",
  "collecting_support",
  "sent_to_official_channel",
  "resolved"
] as const;

export const STATUSES = [
  "pending",
  ...PUBLIC_STATUSES,
  "rejected"
] as const;

export type ProblemCategory = (typeof CATEGORIES)[number];
export type ProblemStatus = (typeof STATUSES)[number];

export type AiModerationResult = {
  title: string;
  clean_description: string;
  desired_result: string;
  category: ProblemCategory;
  risk_flags: string[];
  publish_allowed: boolean;
  moderation_reason: string;
};

export type Problem = {
  id: string;
  created_at: string;
  updated_at: string;
  city: string;
  address: string;
  category: ProblemCategory | string;
  raw_description: string;
  title: string;
  clean_description: string;
  desired_result: string;
  photo_url: string | null;
  photo_urls?: string[] | null;
  status: ProblemStatus;
  risk_flags: string[];
  moderation_reason: string | null;
  confirmations_count: number;
  created_by_telegram_id: string | null;
  created_by_anonymous_key?: string | null;
};

export const statusLabel: Record<ProblemStatus, string> = {
  pending: "На модерации",
  published: "Опубликовано",
  rejected: "Отклонено",
  collecting_support: "Собирает поддержку",
  sent_to_official_channel: "Обращение отправлено",
  resolved: "Решено"
};

export function isProblemCategory(value: string): value is ProblemCategory {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function isProblemStatus(value: string): value is ProblemStatus {
  return (STATUSES as readonly string[]).includes(value);
}
