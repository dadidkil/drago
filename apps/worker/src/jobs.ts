import { db } from "@drago/database";
import {
  agendaCounts,
  agendaDigestText,
  agendaFor,
  assigneeActions,
  createLogger,
  effectiveLevel,
  getSetting,
  getUserPermissions,
  headersSince,
  inboxStatus,
  mailboxAccess,
  markProcessed,
  notify,
} from "@drago/core";
import { formatDateTime, moscowParts } from "@drago/shared";

const log = createLogger("worker:jobs");

const OPEN_ASSIGNEE = ["ASSIGNED", "IN_PROGRESS", "RETURNED"] as const;

/**
 * Напоминания о задачах: за 24 часа до срока — тем, кто ещё не сдал (с кнопкой «Сдать»);
 * после срока — один раз просрочившим и сводка тому, кто поставил. «Захват» через updateMany — без дублей.
 */
export async function taskDeadlineReminders(): Promise<void> {
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 3600_000);
  const upcoming = await db.task.findMany({
    where: { status: { in: ["NEW", "IN_PROGRESS", "REVIEW"] }, dueAt: { gt: now, lte: soon }, reminderSentAt: null },
    include: { assignees: { where: { status: { in: [...OPEN_ASSIGNEE] } }, select: { userId: true, status: true } } },
    take: 200,
  });
  for (const t of upcoming) {
    const claimed = await db.task.updateMany({ where: { id: t.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (claimed.count !== 1) continue;
    for (const a of t.assignees) {
      await notify({
        userIds: [a.userId],
        type: "TASK_DEADLINE",
        title: `Скоро срок: ${t.title}`,
        body: `Сдать до ${formatDateTime(t.dueAt!)}.`,
        url: `/cabinet/tasks/${t.id}`,
        actions: assigneeActions(t.id, a.status),
      });
    }
  }

  const overdue = await db.task.findMany({
    where: { status: { in: ["NEW", "IN_PROGRESS", "REVIEW"] }, dueAt: { lte: now }, overdueNotifiedAt: null },
    include: { assignees: { where: { status: { in: [...OPEN_ASSIGNEE] } }, select: { userId: true, status: true } } },
    take: 200,
  });
  for (const t of overdue) {
    const claimed = await db.task.updateMany({ where: { id: t.id, overdueNotifiedAt: null }, data: { overdueNotifiedAt: now } });
    if (claimed.count !== 1 || t.assignees.length === 0) continue;
    for (const a of t.assignees) {
      await notify({
        userIds: [a.userId],
        type: "TASK_DEADLINE",
        title: `Просрочена задача: ${t.title}`,
        body: `Срок был ${formatDateTime(t.dueAt!)}. Сдайте как можно скорее или напишите в комментарии, что мешает.`,
        url: `/cabinet/tasks/${t.id}`,
        actions: assigneeActions(t.id, a.status),
      });
    }
    if (t.createdById) {
      await notify({
        userIds: [t.createdById],
        type: "TASK_REVIEW",
        title: `Просрочено: ${t.title}`,
        body: `Не сдали в срок: ${t.assignees.length}.`,
        url: `/cabinet/tasks/${t.id}`,
      });
    }
  }
  if (upcoming.length || overdue.length) log.info("task reminders", { upcoming: upcoming.length, overdue: overdue.length });
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
    db.auditLog.deleteMany({ where: { createdAt: { lt: days(privacy.auditRetentionDays) } } }),
  ]);
  const labels = ["sessions", "authTokens", "linkCodes", "processedUpdates", "conversations", "tempMailSecrets", "deliveries", "notifications", "audit"];
  const summary = Object.fromEntries(results.map((r, i) => [labels[i], r.count]));
  log.info("cleanup done", summary);
}

/**
 * Новые письма в корпоративных ящиках: раз в несколько минут смотрим UIDNEXT «Входящих».
 * Появились новые — уведомление владельцу (Telegram/кабинет) и счётчик непрочитанных для бейджа «Почта».
 * Первый проход по ящику только запоминает позицию, чтобы не прислать уведомления о старых письмах.
 */
export async function mailPoll(): Promise<void> {
  const accounts = await db.emailAccount.findMany({
    where: { status: "ACTIVE", passwordEnc: { not: null } },
    select: { id: true, userId: true, address: true, lastUidNext: true, unreadCount: true },
  });
  let notified = 0;
  for (const a of accounts) {
    try {
      const access = await mailboxAccess(a.userId);
      if (!access.ok) continue;
      const st = await inboxStatus(access.creds);
      let fresh: Awaited<ReturnType<typeof headersSince>> = [];
      if (a.lastUidNext && st.uidNext > a.lastUidNext) {
        fresh = (await headersSince(access.creds, a.lastUidNext, 5)).filter((m) => !m.seen && m.fromAddress.toLowerCase() !== a.address.toLowerCase());
      }
      await db.emailAccount.update({ where: { id: a.id }, data: { lastUidNext: st.uidNext, unreadCount: st.unseen, mailCheckedAt: new Date() } });
      if (fresh.length === 0) continue;
      const first = fresh[0]!;
      await notify({
        userIds: [a.userId],
        type: "MAIL_NEW",
        title: fresh.length === 1 ? `Письмо от ${first.from}` : `Новые письма: ${fresh.length}`,
        body: fresh.map((m) => `${m.from} — ${m.subject}`).join("\n").slice(0, 900),
        url: fresh.length === 1 ? `/cabinet/mail/inbox?uid=${first.uid}` : "/cabinet/mail/inbox",
      });
      notified++;
    } catch (err) {
      log.warn("mail poll failed", { accountId: a.id, err: (err as Error).message });
    }
  }
  if (notified) log.info("mail poll", { accounts: accounts.length, notified });
}


/**
 * Утренняя сводка «Мои дела»: в 9 утра по Москве — одно сообщение в Telegram (по настройкам уведомлений)
 * тем, у кого есть незакрытые дела: задачи, проверка, формы, приглашения, письма. Нет дел — не беспокоим.
 * Один прогон в день: «захват» через ProcessedUpdate.
 */
export async function morningDigest(now: Date = new Date()): Promise<void> {
  const p = moscowParts(now);
  if (p.hour !== 9) return;
  const day = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  if (!(await markProcessed("digest-run", day))) return;

  // Только тем, у кого есть куда доставить: без внешних каналов сводка не нужна — есть главная кабинета.
  const users = await db.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ telegramAccount: { is: { blockedBot: false } } }, { vkAccount: { is: { canMessage: true } } }, { emailVerifiedAt: { not: null } }],
    },
    select: { id: true, isOwner: true, roleId: true, role: { select: { level: true } } },
  });
  let sent = 0;
  for (const u of users) {
    try {
      const perms = await getUserPermissions({ roleId: u.roleId, isOwner: u.isOwner });
      const items = await agendaFor({ id: u.id, level: effectiveLevel(u.role.level, u.isOwner), canManage: perms.has("tasks.manage") }, now);
      if (items.length === 0) continue;
      sent += await notify({
        userIds: [u.id],
        type: "DIGEST",
        title: `🔥 Мои дела: ${agendaCounts(items)}`,
        body: agendaDigestText(items),
        url: "/cabinet/dashboard",
        externalOnly: true,
      });
    } catch (err) {
      log.warn("digest failed", { userId: u.id, err: (err as Error).message });
    }
  }
  log.info("morning digest", { day, users: users.length, sent });
}
