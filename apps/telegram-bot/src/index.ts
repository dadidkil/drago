import { Bot } from "grammy";
import { db } from "@drago/database";
import { createLogger } from "@drago/core";
import type { BotContext } from "./context";
import { registerHandlers } from "./handlers";

const log = createLogger("telegram-bot");

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    // Бот не настроен — не падаем в цикл рестартов, а ждём конфигурации.
    log.warn("TELEGRAM_BOT_TOKEN не задан — бот не запущен. Задайте токен в .env и перезапустите сервис.");
    setInterval(() => undefined, 1 << 30);
    return;
  }
  await db.$queryRaw`SELECT 1`;
  const bot = new Bot<BotContext>(token);
  registerHandlers(bot);

  await bot.api.setMyCommands([
    { command: "events", description: "Ближайшие мероприятия" },
    { command: "tasks", description: "Мои задачи" },
    { command: "announcements", description: "Объявления" },
    { command: "documents", description: "Документы" },
    { command: "profile", description: "Профиль" },
    { command: "contacts", description: "Контакты отряда" },
    { command: "cabinet", description: "Личный кабинет" },
    { command: "join", description: "Вступить в отряд" },
    { command: "help", description: "Помощь" },
  ]);
  // Webhook не используется: long polling не требует открытого входящего порта.
  await bot.api.deleteWebhook();

  const stop = async (signal: string) => {
    log.info("stopping", { signal });
    await bot.stop();
    await db.$disconnect();
    process.exit(0);
  };
  process.once("SIGTERM", () => void stop("SIGTERM"));
  process.once("SIGINT", () => void stop("SIGINT"));

  const me = await bot.api.getMe();
  log.info("bot started", { username: me.username });
  await bot.start({ allowed_updates: ["message", "callback_query"], drop_pending_updates: false });
}

main().catch((err) => {
  log.error("fatal", { err });
  process.exit(1);
});
