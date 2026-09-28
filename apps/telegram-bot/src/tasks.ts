import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { db } from "@drago/database";
import {
  appUrl,
  assigneeActions,
  audit,
  clearConversation,
  myOpenTasks,
  reviewActions,
  reviewTask,
  setConversation,
  startTask,
  submissionsToReview,
  submitTask,
  TaskError,
  type NotificationAction,
  type TaskActor,
} from "@drago/core";
import { ASSIGNEE_STATUS_LABELS, escapeHtml, formatDateTime, fullName } from "@drago/shared";
import type { BotContext, LinkedUser } from "./context";

/**
 * Задачи в Telegram: взять в работу, сдать, а для поставившего — принять или вернуть на доработку.
 * Та же логика и те же проверки прав, что в кабинете (packages/core/src/tasks.ts).
 */

export const TASK_RETURN_STATE = "task_return";
const html = { parse_mode: "HTML" as const, link_preview_options: { is_disabled: true } };
const NOT_LINKED = "Эта функция доступна после привязки аккаунта. Откройте личный кабинет → «Безопасность» → «Подключить Telegram».";

export function toKeyboard(actions: NotificationAction[][], openUrl?: string, openLabel = "Открыть в кабинете"): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const row of actions) {
    for (const b of row) {
      if (b.data) kb.text(b.text, b.data);
      else if (b.url) kb.url(b.text, b.url);
    }
    kb.row();
  }
  if (openUrl) kb.url(openLabel, openUrl);
  return kb;
}

export function actorOf(u: LinkedUser): TaskActor {
  return { id: u.id, name: u.profile ? fullName(u.profile) : u.email, level: u.level, canManage: u.can("tasks.manage") };
}

async function answerError(ctx: BotContext, err: unknown) {
  if (err instanceof TaskError) return ctx.answerCallbackQuery({ text: err.message, show_alert: true });
  throw err;
}

export async function myTasks(ctx: BotContext) {
  if (!ctx.linked) return ctx.reply(NOT_LINKED);
  const list = await myOpenTasks(ctx.linked.id, 10);
  if (list.length === 0) return ctx.reply("Открытых задач нет 🎉");
  for (const t of list) {
    const text = [
      `<b>${escapeHtml(t.title)}</b>`,
      `Статус: ${ASSIGNEE_STATUS_LABELS[t.myStatus]}`,
      t.dueAt ? `⏰ до ${formatDateTime(t.dueAt)}` : "Без срока",
    ].join("\n");
    await ctx.reply(text, { ...html, reply_markup: toKeyboard(assigneeActions(t.id, t.myStatus), appUrl(`/cabinet/tasks/${t.id}`)) });
  }
}

export async function toReview(ctx: BotContext) {
  if (!ctx.linked) return ctx.reply(NOT_LINKED);
  const list = await submissionsToReview(actorOf(ctx.linked), 10);
  if (list.length === 0) return ctx.reply("На проверку ничего не сдано 👌");
  for (const r of list) {
    const who = r.user.profile ? fullName(r.user.profile) : r.user.email;
    const note = await db.taskComment.findFirst({
      where: { taskId: r.taskId, subjectUserId: r.userId, kind: "SUBMITTED" },
      orderBy: { createdAt: "desc" },
      select: { body: true, _count: { select: { files: true } } },
    });
    const text = [
      `<b>${escapeHtml(r.task.title)}</b>`,
      `Сдал(а): ${escapeHtml(who)}${r.submittedAt ? `, ${formatDateTime(r.submittedAt)}` : ""}`,
      note && note.body !== "Сдал(а) задачу" ? `«${escapeHtml(note.body.slice(0, 500))}»` : null,
      note?._count.files ? `📎 файлов: ${note._count.files} — смотреть в кабинете` : null,
    ]
      .filter(Boolean)
      .join("\n");
    await ctx.reply(text, { ...html, reply_markup: toKeyboard(reviewActions(r.taskId, r.userId), appUrl(`/cabinet/tasks/${r.taskId}`)) });
  }
}

export function registerTaskHandlers(bot: Bot<BotContext>) {
  bot.command("tasks", myTasks);
  bot.command("review", toReview);

  // Взять в работу / сдать
  bot.callbackQuery(/^tk:(s|d):([a-z0-9]{10,40})$/, async (ctx) => {
    if (!ctx.linked) return ctx.answerCallbackQuery({ text: NOT_LINKED, show_alert: true });
    const [, op, taskId] = ctx.match as RegExpMatchArray;
    try {
      if (op === "s") await startTask(taskId!, actorOf(ctx.linked));
      else await submitTask(taskId!, actorOf(ctx.linked));
    } catch (err) {
      return answerError(ctx, err);
    }
    await audit({ actorId: ctx.linked.id, action: op === "s" ? "task.start" : "task.submit", entity: "Task", entityId: taskId, metadata: { via: "telegram" } });
    const status = op === "s" ? "IN_PROGRESS" : "SUBMITTED";
    await ctx.answerCallbackQuery({ text: op === "s" ? "Задача в работе ▶️" : "Сдано! Ждём проверки 📤" });
    await ctx.editMessageReplyMarkup({ reply_markup: toKeyboard(assigneeActions(taskId!, status), appUrl(`/cabinet/tasks/${taskId}`)) }).catch(() => undefined);
    if (op === "d") await ctx.reply("Задача сдана. Файлы или отчёт можно добавить комментарием в кабинете.", { reply_markup: new InlineKeyboard().url("Открыть задачу", appUrl(`/cabinet/tasks/${taskId}`)) });
  });

  // Старые кнопки из уже отправленных сообщений: «В работу» / «Готово»
  bot.callbackQuery(/^task:([a-z0-9]{10,40}):(IN_PROGRESS|DONE)$/, async (ctx) => {
    if (!ctx.linked) return ctx.answerCallbackQuery({ text: NOT_LINKED, show_alert: true });
    const [, taskId, status] = ctx.match as RegExpMatchArray;
    try {
      if (status === "IN_PROGRESS") await startTask(taskId!, actorOf(ctx.linked));
      else await submitTask(taskId!, actorOf(ctx.linked));
    } catch (err) {
      return answerError(ctx, err);
    }
    await ctx.answerCallbackQuery({ text: status === "IN_PROGRESS" ? "Задача в работе" : "Сдано на проверку" });
    await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard().url("Открыть", appUrl(`/cabinet/tasks/${taskId}`)) }).catch(() => undefined);
  });

  // Проверка: принять сразу, «на доработку» — спросим, что доработать
  bot.callbackQuery(/^tk:(a|r):([a-z0-9]{10,40}):([a-z0-9]{10,40})$/, async (ctx) => {
    if (!ctx.linked || !ctx.from) return ctx.answerCallbackQuery({ text: NOT_LINKED, show_alert: true });
    const [, op, taskId, userId] = ctx.match as RegExpMatchArray;
    if (op === "r") {
      await setConversation("TELEGRAM", BigInt(ctx.from.id), TASK_RETURN_STATE, { taskId: taskId!, userId: userId! });
      await ctx.answerCallbackQuery();
      return ctx.reply("Напишите одним сообщением, что нужно доработать. /cancel — отмена.");
    }
    try {
      await reviewTask(taskId!, userId!, actorOf(ctx.linked), "accept");
    } catch (err) {
      return answerError(ctx, err);
    }
    await audit({ actorId: ctx.linked.id, action: "task.accept", entity: "Task", entityId: taskId, metadata: { assignee: userId, via: "telegram" } });
    await ctx.answerCallbackQuery({ text: "Принято ✅" });
    await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard().url("✅ Принято — открыть", appUrl(`/cabinet/tasks/${taskId}`)) }).catch(() => undefined);
  });
}

/** Текст после «На доработку»: комментарий проверяющего. */
export async function handleTaskReturnText(ctx: BotContext, data: { taskId: string; userId: string }, text: string) {
  if (!ctx.linked || !ctx.from) return;
  await clearConversation("TELEGRAM", BigInt(ctx.from.id));
  try {
    await reviewTask(data.taskId, data.userId, actorOf(ctx.linked), "return", text.slice(0, 2000));
  } catch (err) {
    if (err instanceof TaskError) return ctx.reply(err.message);
    throw err;
  }
  await audit({ actorId: ctx.linked.id, action: "task.return", entity: "Task", entityId: data.taskId, metadata: { assignee: data.userId, via: "telegram" } });
  await ctx.reply("Вернули на доработку ↩️ Исполнитель получит уведомление.", {
    reply_markup: new InlineKeyboard().url("Открыть задачу", appUrl(`/cabinet/tasks/${data.taskId}`)),
  });
}
