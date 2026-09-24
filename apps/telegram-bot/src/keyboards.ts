import { InlineKeyboard, Keyboard } from "grammy";
import type { LinkedUser } from "./context";

export const BTN = {
  events: "📅 Ближайшие мероприятия",
  tasks: "✅ Мои задачи",
  announcements: "📣 Объявления",
  documents: "📄 Документы",
  cabinet: "🔗 Личный кабинет",
  applications: "📥 Заявки",
  about: "🐉 О Драго",
  join: "✍️ Вступить",
  contacts: "☎️ Контакты",
} as const;

export function mainKeyboard(user: LinkedUser | null): Keyboard {
  const kb = new Keyboard();
  if (user) {
    kb.text(BTN.events).text(BTN.tasks).row().text(BTN.announcements).text(BTN.documents).row().text(BTN.cabinet);
    if (user.can("applications.read")) kb.text(BTN.applications);
  } else {
    kb.text(BTN.about).text(BTN.join).row().text(BTN.contacts);
  }
  return kb.resized().persistent();
}

export const rsvpKeyboard = (eventId: string) =>
  new InlineKeyboard().text("Иду", `rsvp:${eventId}:GOING`).text("Возможно", `rsvp:${eventId}:MAYBE`).text("Не смогу", `rsvp:${eventId}:NOT_GOING`);

export const taskKeyboard = (taskId: string, status: string) => {
  const kb = new InlineKeyboard();
  if (status === "NEW") kb.text("▶️ В работу", `task:${taskId}:IN_PROGRESS`);
  if (status !== "DONE") kb.text("✅ Готово", `task:${taskId}:DONE`);
  return kb;
};
