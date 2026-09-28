import { db, type NotificationChannel, type NotificationType, type Prisma } from "@drago/database";
import { NOTIFICATION_META, type ExternalChannel, type PermissionKey } from "@drago/shared";
import { findUsersWithPermission } from "./permissions";
import { createLogger } from "./logger";

const log = createLogger("notifications");

export interface NotifyInput {
  userIds: string[];
  type: NotificationType;
  title: string;
  body: string;
  /** Относительный путь в кабинете, например /cabinet/tasks/abc */
  url?: string;
  /** Ограничить внешние каналы (по умолчанию — по настройкам пользователя). */
  onlyChannels?: ExternalChannel[];
  /** Не уведомлять этого пользователя (обычно — автора действия). */
  excludeUserId?: string;
  /**
   * Кнопки действий в Telegram (строки кнопок): `data` — callback для бота («В работу», «Принять», «Иду»),
   * `url` — ссылка. Кнопка «Открыть» по `url` уведомления добавляется автоматически.
   */
  actions?: NotificationAction[][];
  /**
   * Только во внешние каналы (утренняя сводка): кому некуда доставить — ничего не создаём,
   * в кабинете уведомление сразу помечено прочитанным, чтобы не дублировать главную.
   */
  externalOnly?: boolean;
}

export interface NotificationAction {
  text: string;
  data?: string;
  url?: string;
}

/**
 * Общий notification service.
 * 1) создаёт IN_APP-уведомление (видно в кабинете);
 * 2) ставит в очередь доставки внешние каналы (Telegram/VK/Email) согласно настройкам
 *    пользователя и наличию привязок. Доставку выполняет воркер (apps/worker).
 */
export async function notify(input: NotifyInput): Promise<number> {
  const ids = [...new Set(input.userIds)].filter((id) => id !== input.excludeUserId);
  if (ids.length === 0) return 0;

  const users = await db.user.findMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    select: {
      id: true,
      emailVerifiedAt: true,
      telegramAccount: { select: { blockedBot: true } },
      vkAccount: { select: { canMessage: true } },
      notificationPrefs: { where: { type: input.type }, select: { channel: true, enabled: true } },
    },
  });

  const meta = NOTIFICATION_META[input.type];
  const ops = users.flatMap((u) => {
    const pref = (ch: ExternalChannel) => {
      if (input.onlyChannels && !input.onlyChannels.includes(ch)) return false;
      const p = u.notificationPrefs.find((x) => x.channel === ch);
      return meta.configurable && p ? p.enabled : meta.defaults[ch];
    };
    const channels: NotificationChannel[] = [];
    if (u.telegramAccount && !u.telegramAccount.blockedBot && pref("TELEGRAM")) channels.push("TELEGRAM");
    if (u.vkAccount?.canMessage && pref("VK")) channels.push("VK");
    if (u.emailVerifiedAt && pref("EMAIL")) channels.push("EMAIL");
    if (input.externalOnly && channels.length === 0) return [];

    return db.notification.create({
      data: {
        userId: u.id,
        readAt: input.externalOnly ? new Date() : undefined,
        type: input.type,
        title: input.title.slice(0, 200),
        body: input.body.slice(0, 2000),
        url: input.url,
        actions: input.actions ? (input.actions as unknown as Prisma.InputJsonValue) : undefined,
        deliveries: { create: channels.map((channel) => ({ channel })) },
      },
      select: { id: true },
    });
  });

  await db.$transaction(ops);
  log.info("notifications queued", { type: input.type, count: ops.length });
  return ops.length;
}

export async function notifyByPermission(permission: PermissionKey, input: Omit<NotifyInput, "userIds">): Promise<number> {
  const userIds = await findUsersWithPermission(permission);
  return notify({ ...input, userIds });
}

/** Всем активным пользователям с уровнем роли не ниже minRoleLevel. */
export async function notifyAudience(minRoleLevel: number, input: Omit<NotifyInput, "userIds">): Promise<number> {
  const users = await db.user.findMany({
    where: { status: "ACTIVE", role: { level: { gte: minRoleLevel } } },
    select: { id: true },
  });
  return notify({ ...input, userIds: users.map((u) => u.id) });
}
