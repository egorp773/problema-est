import assert from "node:assert/strict";
import { fallbackModerate, type ModerationInput } from "./ai";

const base: Omit<ModerationInput, "rawText" | "desiredResult"> = {
  category: "ЖКХ",
  city: "Нижний Новгород",
  address: "Нижегородский район"
};

const bannedPhrases = [
  "лица, действия которых требуется проверить",
  "виновные лица",
  "противоправные действия",
  "нарушители",
  "злоупотребление"
];

function checkNoBannedPhrases(text: string) {
  for (const phrase of bannedPhrases) {
    assert.equal(text.toLowerCase().includes(phrase), false, `Found banned phrase: ${phrase}`);
  }
}

function runCase(rawText: string, desiredResult = "Проверить и исправить") {
  const result = fallbackModerate({ ...base, rawText, desiredResult });
  checkNoBannedPhrases(result.title);
  checkNoBannedPhrases(result.clean_description);
  checkNoBannedPhrases(result.desired_result);
  return result;
}

const snow = runCase("Не убирают снег во дворе");
assert.equal(snow.title, "Во дворе не убирают снег");
assert.equal(snow.risk_flags.length, 0);
assert.equal(snow.publish_allowed, true);
assert.equal(snow.moderation_reason, "Явных рисков не найдено. Требуется стандартная ручная проверка перед публикацией.");

const trash = runCase("Во дворе мусор уже неделю");
assert.equal(trash.risk_flags.length, 0);
assert.match(trash.clean_description, /мусор/i);

const repair = runCase("УК собрала деньги и не сделала ремонт");
assert.equal(repair.risk_flags.length, 0);
assert.match(repair.title, /ремонт/i);

const thieves = runCase("Эти воры ничего не делают");
assert.deepEqual(thieves.risk_flags, ["прямое обвинение без доказательств"]);
assert.equal(thieves.publish_allowed, false);

const insult = runCase("Директор школы идиот");
assert.deepEqual(insult.risk_flags, ["оскорбления"]);
assert.equal(insult.publish_allowed, false);

const light = runCase("Не работает фонарь у дома");
assert.equal(light.title, "Не работает фонарь у дома");
assert.equal(light.risk_flags.length, 0);

const badDesired = runCase("Не убирают снег во дворе", "3213");
assert.equal(badDesired.desired_result, "Организовать уборку снега и проверить работу ответственных служб.");

console.log("AI fallback cases passed");
