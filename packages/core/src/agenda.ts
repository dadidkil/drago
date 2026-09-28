import { db } from "@drago/database";
import { ASSIGNEE_STATUS_LABELS, formatDateTime, fullName, plural } from "@drago/shared";
import type { NotificationAction } from "./notifications";
import { surveysForUser } from "./surveys";
import { assigneeActions, myOpenTasks, reviewActions, submissionsToReview } from "./tasks";

/**
 * «Мои дела» — всё, что ждёт от человека действия, в одном списке: обязательные формы, задачи,
 * сдачи на проверку, мероприятия без ответа, непрочитанная почта. Один источник для дашборда кабинета,
 * кнопки «🔥 Мои дела» в Telegram и утренней сводки воркера.
 */

export type AgendaKind = "survey" | "task" | "review" | "event" | "mail";

export interface AgendaItem {
  kind: AgendaKind;
  key: string;
  title: string;
  detail: string;
  /** Путь в кабинете. */
  url: string;
  dueAt: Date | null;
  /** Просрочено, возвращено на доработку или срок в ближайшие сутки — показываем первым. */
  urgent: boolean;
  /** Кнопки для Telegram (те же callback, что в уведомлениях). */
  actions: NotificationAction[][];
}

export interface AgendaUser {
  id: string;
  level: number;
  /** Право tasks.manage — видит сдачи чужих задач своего уровня. */
  canManage: boolean;
}

/** Приглашения, на которые ждут ответа, — не дальше двух недель. */
const EVENT_HORIZON_MS = 14 * 86400_000;
const SOON_MS = 24 * 3600_000;

export const RSVP_CALLBACK = (eventId: string, status: "GOING" | "MAYBE" | "NOT_GOING") => `rsvp:${eventId}:${status}`;

export function rsvpActions(eventId: string): NotificationAction[][] {
  return [
    [
      { text: "✅ Иду", data: RSVP_CALLBACK(eventId, "GOING") },
      { text: "🤔 Возможно", data: RSVP_CALLBACK(eventId, "MAYBE") },
      { text: "❌ Не смогу", data: RSVP_CALLBACK(eventId, "NOT_GOING") },
    ],
  ];
}

export async function agendaFor(user: AgendaUser, now: Date = new Date()): Promise<AgendaItem[]> {
  const soon = (d: Date | null) => Boolean(d && d.getTime() - now.getTime() < SOON_MS);
  const [surveys, tasks, reviews, events, mailbox] = await Promise.all([
    surveysForUser({ id: user.id, roleLevel: user.level }, now),
    myOpenTasks(user.id, 50),
    submissionsToReview(user, 50),
    db.event.findMany({
      where: {
        status: "SCHEDULED",
        requiresConfirmation: true,
        minRoleLevel: { lte: user.level },
        startsAt: { gt: now, lte: new Date(now.getTime() + EVENT_HORIZON_MS) },
        // Только личные приглашения без ответа («Пригласить всю аудиторию» тоже создаёт приглашения).
        participants: { some: { userId: user.id, status: "INVITED" } },
      },
      orderBy: { startsAt: "asc" },
      take: 10,
      select: { id: true, title: true, startsAt: true, location: true },
    }),
    db.emailAccount.findUnique({ where: { userId: user.id }, select: { status: true, unreadCount: true } }),
  ]);

  const items: AgendaItem[] = [];

  for (const s of surveys) {
    if (s.status === "done") continue;
    items.push({
      kind: "survey",
      key: `survey:${s.survey.id}`,
      title: s.survey.title,
      detail: s.status === "overdue" ? "Форма просрочена — пройдите сейчас" : `Пройти до ${formatDateTime(s.period.dueAt)}`,
      url: `/cabinet/surveys/${s.survey.id}`,
      dueAt: s.period.dueAt,
      urgent: s.status === "overdue" || soon(s.period.dueAt),
      actions: [],
    });
  }

  for (const t of tasks) {
    if (t.myStatus === "SUBMITTED") continue; // сдано — ход за проверяющим
    const overdue = Boolean(t.dueAt && t.dueAt <= now);
    items.push({
      kind: "task",
      key: `task:${t.id}`,
      title: t.title,
      detail: [ASSIGNEE_STATUS_LABELS[t.myStatus], t.dueAt ? (overdue ? `срок был ${formatDateTime(t.dueAt)}` : `до ${formatDateTime(t.dueAt)}`) : null]
        .filter(Boolean)
        .join(" · "),
      url: `/cabinet/tasks/${t.id}`,
      dueAt: t.dueAt,
      urgent: t.myStatus === "RETURNED" || overdue || soon(t.dueAt),
      actions: assigneeActions(t.id, t.myStatus),
    });
  }

  for (const r of reviews) {
    const who = r.user.profile ? fullName(r.user.profile) : r.user.email;
    items.push({
      kind: "review",
      key: `review:${r.taskId}:${r.userId}`,
      title: `Проверить: ${r.task.title}`,
      detail: `Сдал(а) ${who}${r.submittedAt ? `, ${formatDateTime(r.submittedAt)}` : ""}`,
      url: `/cabinet/tasks/${r.taskId}`,
      dueAt: r.task.dueAt,
      // Сдали больше суток назад — человек ждёт ответа.
      urgent: Boolean(r.submittedAt && now.getTime() - r.submittedAt.getTime() > SOON_MS),
      actions: reviewActions(r.taskId, r.userId),
    });
  }

  for (const e of events) {
    items.push({
      kind: "event",
      key: `event:${e.id}`,
      title: `Ответьте: ${e.title}`,
      detail: `${formatDateTime(e.startsAt)}${e.location ? `, ${e.location}` : ""} — придёте?`,
      url: `/cabinet/events/${e.id}`,
      dueAt: e.startsAt,
      urgent: e.startsAt.getTime() - now.getTime() < 2 * SOON_MS,
      actions: rsvpActions(e.id),
    });
  }

  if (mailbox?.status === "ACTIVE" && mailbox.unreadCount > 0) {
    const n = mailbox.unreadCount;
    items.push({
      kind: "mail",
      key: "mail",
      title: `${n} ${plural(n, "непрочитанное письмо", "непрочитанных письма", "непрочитанных писем")}`,
      detail: "Корпоративная почта",
      url: "/cabinet/mail/inbox",
      dueAt: null,
      urgent: false,
      actions: [],
    });
  }

  return items.sort(
    (a, b) => Number(b.urgent) - Number(a.urgent) || (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity),
  );
}

export const AGENDA_ICON: Record<AgendaKind, string> = { survey: "📝", task: "✅", review: "🧐", event: "📅", mail: "✉️" };

/** Короткая сводка текстом: «2 задачи, 1 форма, 1 на проверку». */
export function agendaCounts(items: AgendaItem[]): string {
  const count = (k: AgendaKind) => items.filter((i) => i.kind === k).length;
  const parts = [
    [count("task"), plural(count("task"), "задача", "задачи", "задач")],
    [count("review"), "на проверку"],
    [count("survey"), plural(count("survey"), "форма", "формы", "форм")],
    [count("event"), plural(count("event"), "мероприятие ждёт ответа", "мероприятия ждут ответа", "мероприятий ждут ответа")],
  ] as const;
  const text = parts.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`);
  const mail = items.find((i) => i.kind === "mail");
  if (mail) text.push(mail.title);
  return text.join(", ");
}

/** Текст сводки для Telegram/почты (без HTML). */
export function agendaDigestText(items: AgendaItem[], limit = 8): string {
  const lines = items.slice(0, limit).map((i) => `${i.urgent ? "❗" : AGENDA_ICON[i.kind]} ${i.title} — ${i.detail}`);
  if (items.length > limit) lines.push(`…и ещё ${items.length - limit}`);
  return lines.join("\n");
}
