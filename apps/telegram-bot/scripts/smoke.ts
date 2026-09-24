/**
 * Интеграционный smoke-тест обработчиков бота без сети: вызовы Bot API перехватываются.
 * Требует БД с тестовыми данными:
 *   pnpm --filter @drago/telegram-bot exec tsx --env-file=../../.env scripts/smoke.ts <email-бойца>
 */
import { Bot } from "grammy";
import { db } from "@drago/database";
import { createLinkCode } from "@drago/core";
import type { BotContext } from "../src/context";
import { registerHandlers } from "../src/handlers";

const email = process.argv[2] ?? "ivan.test@example.com";
const calls: { method: string; payload: Record<string, unknown> }[] = [];
const bot = new Bot<BotContext>("123456:TEST", {
  botInfo: { id: 1, is_bot: true, first_name: "Drago", username: "drago_test_bot" } as never,
});
bot.api.config.use(async (_prev, method, payload) => {
  calls.push({ method, payload: payload as Record<string, unknown> });
  return { ok: true, result: true } as never;
});
registerHandlers(bot);

let updateId = Math.floor(Date.now() / 1000);
const from = { id: 99887766, is_bot: false, first_name: "Иван", username: "ivan_drago" };
const chat = { id: from.id, type: "private" as const, first_name: "Иван" };
const text = (t: string) => {
  const isCmd = t.startsWith("/");
  return bot.handleUpdate({
    update_id: ++updateId,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat,
      from,
      text: t,
      ...(isCmd ? { entities: [{ type: "bot_command", offset: 0, length: t.split(" ")[0]!.length }] } : {}),
    },
  } as never);
};
const lastText = () => String(calls.filter((c) => c.method === "sendMessage").at(-1)?.payload.text ?? "");

const user = await db.user.findFirstOrThrow({ where: { email } });
await db.telegramAccount.deleteMany({ where: { OR: [{ userId: user.id }, { telegramUserId: BigInt(from.id) }] } });

await text("/start");
console.log("1 /start (не привязан):", lastText().slice(0, 70));
await text("/tasks");
console.log("2 /tasks (не привязан):", lastText().slice(0, 70));
const { code } = await createLinkCode(user.id, "TELEGRAM");
await text(`/start link_${code}`);
console.log("3 привязка:", lastText().slice(0, 70));
console.log("  telegramUserId:", (await db.telegramAccount.findUnique({ where: { userId: user.id } }))?.telegramUserId.toString());
await text(`/start link_${code}`);
console.log("4 повтор кода:", lastText().slice(0, 70));
await text("/tasks");
console.log("5 /tasks:", lastText().split("\n")[0]);
const task = await db.task.findFirst({ where: { assignees: { some: { userId: user.id } } } });
if (task) {
  await bot.handleUpdate({
    update_id: ++updateId,
    callback_query: { id: "cb1", from, chat_instance: "x", data: `task:${task.id}:IN_PROGRESS`, message: { message_id: 1, date: 0, chat, text: "x" } },
  } as never);
  console.log("6 статус задачи через кнопку:", (await db.task.findUnique({ where: { id: task.id } }))?.status);
}
await text("/events");
console.log("7 /events:", lastText().split("\n")[0]);
await text("/applications");
console.log("8 /applications (боец):", lastText());
await text("/announce");
console.log("9 /announce (боец):", lastText());
await text("/profile");
console.log("10 /profile:", lastText().replace(/\n/g, " | "));
await db.$disconnect();
process.exit(0);
