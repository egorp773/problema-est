import { CATEGORIES, isProblemCategory, type AiModerationResult, type ProblemCategory } from "@problema-est/shared";
import OpenAI from "openai";

export type ModerationInput = {
  rawText: string;
  category: string;
  city: string;
  address: string;
  desiredResult: string;
};

const SAFE_REASON = "Явных рисков не найдено. Требуется стандартная ручная проверка перед публикацией.";

const bannedLegalPhrases = [
  "лица, действия которых требуется проверить",
  "виновные лица",
  "противоправные действия",
  "нарушители",
  "злоупотребление"
];

const typoReplacements: Array<[RegExp, string]> = [
  [/\bуберают\b/gi, "убирают"],
  [/\bжкхшники\b/gi, "службы ЖКХ"],
  [/\bдлица\b/gi, "по указанному адресу"]
];

const riskPatterns: Array<{ pattern: RegExp; flag: string }> = [
  { pattern: /(^|[^а-яё])(бля|блять|хуй|пизд|ебан|ёбан|сука)[а-яё]*/i, flag: "мат" },
  { pattern: /(^|[^а-яё])(идиот|урод|твар|дебил|мразь)[а-яё]*/i, flag: "оскорбления" },
  { pattern: /(^|[^а-яё])(вор|воры|мошенник|мошенники|украл|украли|присвоил|присвоили)[а-яё]*/i, flag: "прямое обвинение без доказательств" },
  { pattern: /\+?\d[\d\s().-]{8,}\d/i, flag: "персональные данные" },
  { pattern: /(^|[^а-яё])(паспорт|снилс|инн)([^а-яё]|$)/i, flag: "персональные данные" },
  { pattern: /(^|[^а-яё])(убить|сжечь|сломать|разнести|отомстить)[а-яё]*/i, flag: "угрозы или призывы к незаконным действиям" }
];

function normalizeSpaces(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function capitalize(text: string) {
  const value = text.trim();
  if (!value) return value;
  return value[0].toUpperCase() + value.slice(1);
}

function endSentence(text: string) {
  const value = normalizeSpaces(text);
  if (!value) return value;
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function applyBasicCorrections(text: string) {
  return typoReplacements.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}

function stripDangerousAccusations(text: string) {
  return text
    .replace(/\bэти\s+воры\b/gi, "ответственные службы")
    .replace(/\bворы\b/gi, "ответственные службы")
    .replace(/\bмошенники\b/gi, "ответственные службы")
    .replace(/\bукрали\b/gi, "деньги были собраны, но результат работ не виден")
    .replace(/\bукрал\b/gi, "деньги были собраны, но результат работ не виден")
    .replace(/\bидиот\b/gi, "работает неудовлетворительно")
    .replace(/\bурод\b/gi, "работает неудовлетворительно")
    .replace(/\bтварь\b/gi, "работает неудовлетворительно");
}

function detectRiskFlags(text: string) {
  const flags = riskPatterns
    .filter(({ pattern }) => pattern.test(text))
    .map(({ flag }) => flag);
  return [...new Set(flags)];
}

function meaningfulDesiredResult(text: string) {
  const value = normalizeSpaces(applyBasicCorrections(text));
  const letters = value.match(/[a-zа-яё]/gi)?.length ?? 0;
  return letters >= 5 ? endSentence(capitalize(value)) : "";
}

function extractEssence(rawText: string) {
  const corrected = normalizeSpaces(applyBasicCorrections(rawText));
  const neutral = normalizeSpaces(stripDangerousAccusations(corrected));
  return neutral || "описанная проблема";
}

function buildTitle(essence: string, category: ProblemCategory) {
  const lower = essence.toLowerCase();

  if (lower.includes("не убирают снег") || lower.includes("снег не убирают")) return "Во дворе не убирают снег";
  if (lower.includes("мусор")) return "Во дворе не убирают мусор";
  if (lower.includes("фонарь") || lower.includes("освещ")) return "Не работает фонарь у дома";
  if (lower.includes("ремонт")) return "Не завершён ремонт";

  const withoutAddressNoise = essence
    .replace(/^по указанному адресу\s*/i, "")
    .replace(/^во дворе\s*/i, "Во дворе ")
    .replace(/\.$/, "");

  const title = capitalize(withoutAddressNoise).slice(0, 70);
  return title || `${category}: требуется проверка`;
}

function buildDesiredResult(essence: string, category: ProblemCategory, provided: string) {
  const desired = meaningfulDesiredResult(provided);
  if (desired) return desired;

  const lower = essence.toLowerCase();
  if (lower.includes("снег")) return "Организовать уборку снега и проверить работу ответственных служб.";
  if (lower.includes("мусор")) return "Организовать уборку мусора и проверить регулярность вывоза.";
  if (lower.includes("фонарь") || lower.includes("освещ")) return "Восстановить освещение и проверить состояние фонаря.";
  if (lower.includes("ремонт")) return "Проверить ситуацию с ремонтом и добиться выполнения необходимых работ.";

  if (category === "дороги") return "Проверить состояние дороги и устранить проблему.";
  if (category === "экология") return "Проверить ситуацию и устранить экологическую проблему.";
  return "Проверить ситуацию и устранить проблему.";
}

function buildDescription(essence: string, category: ProblemCategory) {
  const lower = essence.toLowerCase();

  if (lower.includes("не убирают снег") || lower.includes("снег не убирают")) {
    return "Во дворе по указанному адресу не убирают снег. Жители просят проверить качество уборки и принять меры.";
  }
  if (lower.includes("мусор")) {
    return "Во дворе по указанному адресу уже несколько дней не убирают мусор. Жители просят проверить уборку территории и принять меры.";
  }
  if (lower.includes("фонарь") || lower.includes("освещ")) {
    return "У дома по указанному адресу не работает фонарь. Жители просят проверить освещение и восстановить его.";
  }

  const sentence = endSentence(essence.toLowerCase());
  if (category === "ЖКХ") {
    return `По указанному адресу зафиксирована проблема в сфере ЖКХ: ${sentence} Жители просят проверить ситуацию и принять меры.`;
  }
  if (category === "дороги") {
    return `На указанном участке дороги зафиксирована проблема: ${sentence} Жители просят проверить состояние дороги и принять меры.`;
  }
  if (category === "экология") {
    return `Жители сообщают об экологической проблеме по указанному адресу: ${sentence} Требуется проверка и устранение последствий.`;
  }

  return `По указанному адресу зафиксирована проблема: ${sentence} Жители просят проверить ситуацию и принять меры.`;
}

function cleanAiText(text: string) {
  let result = normalizeSpaces(applyBasicCorrections(text));
  for (const phrase of bannedLegalPhrases) {
    result = result.replace(new RegExp(phrase, "gi"), "ответственные службы");
  }
  return result;
}

export function fallbackModerate(input: ModerationInput): AiModerationResult {
  const category = isProblemCategory(input.category) ? input.category : "другое";
  const correctedRaw = applyBasicCorrections(input.rawText);
  const risk_flags = detectRiskFlags(correctedRaw);
  const essence = extractEssence(correctedRaw);

  return {
    title: buildTitle(essence, category).slice(0, 90),
    clean_description: buildDescription(essence, category),
    desired_result: buildDesiredResult(essence, category, input.desiredResult),
    category,
    risk_flags,
    publish_allowed: risk_flags.length === 0,
    moderation_reason: risk_flags.length
      ? "Найдены рискованные формулировки. Требуется ручная проверка и нейтральная редактура перед публикацией."
      : SAFE_REASON
  };
}

function normalizeAiResult(data: unknown, input: ModerationInput): AiModerationResult {
  const fallback = fallbackModerate(input);
  const record = data as Partial<AiModerationResult>;
  const category = typeof record.category === "string" && isProblemCategory(record.category) ? record.category : fallback.category;
  const risk_flags = Array.isArray(record.risk_flags) ? record.risk_flags.map(String).filter(Boolean) : fallback.risk_flags;

  return {
    title: cleanAiText(String(record.title || fallback.title)).slice(0, 90),
    clean_description: cleanAiText(String(record.clean_description || fallback.clean_description)).slice(0, 1000),
    desired_result: meaningfulDesiredResult(String(record.desired_result || "")) || fallback.desired_result,
    category: category as ProblemCategory,
    risk_flags,
    publish_allowed: risk_flags.length === 0 ? Boolean(record.publish_allowed ?? true) : false,
    moderation_reason: String(record.moderation_reason || (risk_flags.length ? fallback.moderation_reason : SAFE_REASON)).slice(0, 1000)
  };
}

export async function moderateProblem(input: ModerationInput): Promise<AiModerationResult> {
  if (process.env.AI_API_URL) {
    try {
      const response = await fetch(process.env.AI_API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(process.env.AI_API_KEY ? { authorization: `Bearer ${process.env.AI_API_KEY}` } : {})
        },
        body: JSON.stringify(input)
      });
      if (response.ok) {
        return normalizeAiResult(await response.json(), input);
      }
    } catch {
      return fallbackModerate(input);
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    return fallbackModerate(input);
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Ты редактор Telegram Mini App о городских проблемах. Верни строго JSON с полями title, clean_description, desired_result, category, risk_flags, publish_allowed, moderation_reason. Пиши простым человеческим языком. Описание 1-3 предложения. Не превращай обычные жалобы в юридический текст. Не используй фразы: лица, действия которых требуется проверить; виновные лица; противоправные действия; нарушители; злоупотребление. Не выдумывай обвинения. Если написано 'не убирают снег', пиши только про факт: снег не убирают. Исправляй явные опечатки. Risk flags ставь только при мате, оскорблениях, прямых обвинениях без доказательств, персональных данных, угрозах или призывах к незаконным действиям. Обычная безопасная проблема должна иметь publish_allowed=true, risk_flags=[], moderation_reason='Явных рисков не найдено. Требуется стандартная ручная проверка перед публикацией.'"
        },
        {
          role: "user",
          content: JSON.stringify({
            ...input,
            allowed_categories: CATEGORIES,
            examples: [
              {
                raw: "Не убирают снег во дворе",
                title: "Во дворе не убирают снег",
                clean_description:
                  "Во дворе по указанному адресу не убирают снег. Жители просят проверить качество уборки и принять меры.",
                desired_result: "Организовать уборку снега и проверить работу ответственных служб."
              }
            ]
          })
        }
      ]
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return fallbackModerate(input);
    return normalizeAiResult(JSON.parse(content), input);
  } catch {
    return fallbackModerate(input);
  }
}
