import { db } from "@drago/database";
import { createLogger, getSetting, notify } from "@drago/core";
import { formatDateTime } from "@drago/shared";

const log = createLogger("worker:jobs");

/** Напоминания о дедлайнах задач за 24 часа. Атомарный «захват» задачи через updateMany — без дублей. */
export async function taskDeadlineReminders(): Promise<void> {
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 3600_000);
  const tasks = await db.task.findMany({
    where: { status: { in: ["NEW", "IN_PROGRESS"] }, dueAt: { gt: now, lte: soon }, reminderSentAt: null },
    include: { assignees: { select: { userId: true } } },
    take: 200,
  });
  for (const t of tasks) {
    const claimed = await db.task.updateMany({ where: { id: t.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (claimed.count !== 1) continue;
    await notify({
      userIds: t.assignees.map((a) => a.userId),
      type: "TASK_DEADLINE",
      title: `Скоро дедлайн: ${t.title}`,
      body: `Срок: ${formatDateTime(t.dueAt!)}`,
      url: `/cabinet/tasks/${t.id}`,
    });
  }
  if (tasks.length) log.info("task reminders", { count: tasks.length });
}

/** Напоминания о мероприятиях за 24 часа — приглашённым и тем, кто идёт. */
export async function eventReminders(): Promise<void> {
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 3600_000);
  const events = await db.event.findMany({
    where: { status: "SCHEDULED", startsAt: { gt: now, lte: soon }, reminderSentAt: null },
    include: { participants: { where: { status: { in: ["GOING", "MAYBE", "INVITED"] } }, select: { userId: true } } },
    take: 100,
  });
  for (const e of events) {
    const claimed = await db.event.updateMany({ where: { id: e.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (claimed.count !== 1 || e.participants.length === 0) continue;
    await notify({
      userIds: e.participants.map((p) => p.userId),
      type: "EVENT_REMINDER",
      title: `Завтра: ${e.title}`,
      body: `${formatDateTime(e.startsAt)}${e.location ? `, ${e.location}` : ""}`,
      url: `/cabinet/events/${e.id}`,
    });
  }
  if (events.length) log.info("event reminders", { count: events.length });
}

/** Очистка: истёкшие сессии и токены, старые служебные записи, сроки хранения ПДн. */
export async function cleanup(): Promise<void> {
  const now = new Date();
  const days = (n: number) => new Date(now.getTime() - n * 86400_000);
  const privacy = await getSetting("privacy");

  const results = await db.$transaction([
    db.session.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { createdAt: { lt: days(31) } }] } }),
    db.authToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] } }),
    db.linkCode.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] } }),
    db.processedUpdate.deleteMany({ where: { createdAt: { lt: days(7) } } }),
    db.botConversation.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.emailAccount.updateMany({ where: { pendingSecretExpiresAt: { lt: now } }, data: { pendingSecretEnc: null, pendingSecretExpiresAt: null } }),
    db.notificationDelivery.deleteMany({ where: { status: { in: ["SENT", "SKIPPED"] }, createdAt: { lt: days(30) } } }),
    db.notification.deleteMany({ where: { readAt: { not: null }, createdAt: { lt: days(180) } } }),
    // Срок хранения заявок (минимизация ПДн несовершеннолетних).
    db.joinApplication.deleteMany({ where: { createdAt: { lt: days(privacy.applicationRetentionDays) } } }),
    db.auditLog.deleteMany({ where: { createdAt: { lt: days(privacy.auditRetentionDays) } } }),
  ]);
  const labels = ["sessions", "authTokens", "linkCodes", "processedUpdates", "conversations", "tempMailSecrets", "deliveries", "notifications", "applications", "audit"];
  const summary = Object.fromEntries(results.map((r, i) => [labels[i], r.count]));
  log.info("cleanup done", summary);
}
