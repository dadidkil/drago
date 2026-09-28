import { InlineKeyboard } from "grammy";
import { AGENDA_ICON, agendaCounts, agendaFor, appUrl, type AgendaKind } from "@drago/core";
import { escapeHtml } from "@drago/shared";
import type { BotContext } from "./context";
import { toKeyboard } from "./tasks";

/**
 * «🔥 Мои дела» в Telegram: всё, что ждёт действия, — каждое дело отдельным сообщением
 * с кнопками («В работу», «Сдать», «Принять», «Иду»…). Тот же список, что на главной кабинета.
 */

const html = { parse_mode: "HTML" as const, link_preview_options: { is_disabled: true } };
const NOT_LINKED = "Эта функция доступна после привязки аккаунта. Откройте личный кабинет → «Безопасность» → «Подключить Telegram».";
const LIMIT = 8;

const OPEN_LABEL: Record<AgendaKind, string> = {
  survey: "📝 Пройти форму",
  task: "Открыть задачу",
  review: "Открыть сдачу",
  event: "Подробнее",
  mail: "✉️ Открыть почту",
};

export async function today(ctx: BotContext) {
  const u = ctx.linked;
  if (!u) return ctx.reply(NOT_LINKED);
  const items = await agendaFor({ id: u.id, level: u.level, canManage: u.can("tasks.manage") });
  if (items.length === 0) {
    return ctx.reply("🔥 Все дела сделаны! Новые задачи, формы и приглашения придут сюда уведомлением.");
  }
  await ctx.reply(`<b>🔥 Мои дела</b>\n${escapeHtml(agendaCounts(items))}`, html);
  for (const i of items.slice(0, LIMIT)) {
    const text = `${i.urgent ? "❗" : AGENDA_ICON[i.kind]} <b>${escapeHtml(i.title)}</b>\n${escapeHtml(i.detail)}`;
    await ctx.reply(text, { ...html, reply_markup: toKeyboard(i.actions, appUrl(i.url), OPEN_LABEL[i.kind]) });
  }
  if (items.length > LIMIT) {
    await ctx.reply(`…и ещё ${items.length - LIMIT}. Весь список — на главной кабинета.`, {
      reply_markup: new InlineKeyboard().url("Открыть «Мои дела»", appUrl("/cabinet/dashboard")),
    });
  }
}
