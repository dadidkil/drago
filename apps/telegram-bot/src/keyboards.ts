import { InlineKeyboard, Keyboard } from "grammy";
import type { LinkedUser } from "./context";

export const BTN = {
  today: "🔥 Мои дела",
  events: "📅 Ближайшие мероприятия",
  tasks: "✅ Мои задачи",
  review: "🧐 На проверку",
  announcements: "📣 Объявления",
  documents: "📄 Документы",
  cabinet: "🔗 Личный кабинет",
  about: "🐉 О Драго",
  join: "✍️ Вступить",
  contacts: "☎️ Контакты",
} as const;

export function mainKeyboard(user: LinkedUser | null): Keyboard {
  const kb = new Keyboard();
  if (user) {
    kb.text(BTN.today).text(BTN.tasks).row();
    if (user.can("tasks.manage")) kb.text(BTN.review);
    kb.text(BTN.events).row().text(BTN.announcements).text(BTN.documents).row().text(BTN.cabinet);
  } else {
    kb.text(BTN.about).text(BTN.join).row().text(BTN.contacts);
  }
  return kb.resized().persistent();
}

const RSVP_BUTTONS = [
  ["GOING", "✅ Иду"],
  ["MAYBE", "🤔 Возможно"],
  ["NOT_GOING", "❌ Не смогу"],
] as const;

/** Кнопки ответа на мероприятие; выбранный ответ отмечен «•». */
export function rsvpKeyboard(eventId: string, selected?: string | null): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const [status, label] of RSVP_BUTTONS) kb.text(selected === status ? `• ${label} •` : label, `rsvp:${eventId}:${status}`);
  return kb;
}

