import "dotenv/config";
import { Markup, Telegraf } from "telegraf";

const token = process.env.BOT_TOKEN;
const webAppUrl = process.env.TELEGRAM_WEB_APP_URL || process.env.NEXT_PUBLIC_APP_URL;

if (!token) {
  throw new Error("BOT_TOKEN is required");
}

if (!webAppUrl) {
  throw new Error("TELEGRAM_WEB_APP_URL or NEXT_PUBLIC_APP_URL is required");
}

const bot = new Telegraf(token);

bot.start(async (ctx) => {
  await ctx.reply(
    "Проблема есть — сервис, где можно сообщить о проблеме и собрать поддержку людей.",
    Markup.inlineKeyboard([
      Markup.button.webApp("Открыть приложение", webAppUrl)
    ])
  );
});

bot.catch((error) => {
  console.error("Telegram bot error", error);
});

await bot.launch();
console.log("Telegram bot started");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
