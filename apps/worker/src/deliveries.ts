import { db } from "@drago/database";
import {
  appUrl,
  createLogger,
  notificationMail,
  sendMail,
  sendTelegramMessage,
  sendVkMessage,
  VkApiError,
} from "@drago/core";
import { escapeHtml } from "@drago/shared";

const log = createLogger("worker:deliveries");
const BATCH = 50;
const MAX_ATTEMPTS = 6;
const BACKOFF_MIN = [1, 5, 30, 120, 360, 720];

class SkipDelivery extends Error {}

/** Забираем пачку доставок: SKIP LOCKED позволяет запускать несколько воркеров без дублей. */
async function claimBatch(): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE "NotificationDelivery" SET "lockedUntil" = now() + interval '2 minutes'
    WHERE id IN (
      SELECT id FROM "NotificationDelivery"
      WHERE status = 'PENDING' AND "nextAttemptAt" <= now() AND ("lockedUntil" IS NULL OR "lockedUntil" < now())
      ORDER BY "nextAttemptAt" ASC
      LIMIT ${BATCH}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`;
  return rows.map((r) => r.id);
}

async function deliver(id: string): Promise<void> {
  const d = await db.notificationDelivery.findUnique({
    where: { id },
    include: {
      notification: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              status: true,
              emailVerifiedAt: true,
              telegramAccount: { select: { telegramUserId: true, blockedBot: true } },
              vkAccount: { select: { vkUserId: true, canMessage: true } },
            },
          },
        },
      },
    },
  });
  if (!d || d.status !== "PENDING") return;
  const n = d.notification;
  const user = n.user;
  const link = n.url ? appUrl(n.url) : appUrl("/cabinet");

  try {
    if (user.status !== "ACTIVE") throw new SkipDelivery("user inactive");
    switch (d.channel) {
      case "TELEGRAM": {
        if (!user.telegramAccount || user.telegramAccount.blockedBot) throw new SkipDelivery("telegram not linked");
        const res = await sendTelegramMessage(user.telegramAccount.telegramUserId, `<b>${escapeHtml(n.title)}</b>\n${escapeHtml(n.body)}`, {
          buttonUrl: link,
          buttonText: "Открыть в кабинете",
        });
        if (!res.ok) {
          if (res.errorCode === 403) {
            // Пользователь заблокировал бота — дальше не пытаемся.
            await db.telegramAccount.update({ where: { userId: user.id }, data: { blockedBot: true } });
            throw new SkipDelivery("bot blocked by user");
          }
          const err = new Error(`telegram ${res.errorCode}: ${res.description}`);
          (err as Error & { retryAfter?: number }).retryAfter = res.retryAfter;
          throw err;
        }
        break;
      }
      case "VK": {
        if (!user.vkAccount || !user.vkAccount.canMessage) throw new SkipDelivery("vk not linked");
        try {
          // random_id детерминирован от id доставки — VK не продублирует сообщение при повторе.
          const randomId = Number.parseInt(d.id.slice(-7), 36) % 2_000_000_000;
          await sendVkMessage(user.vkAccount.vkUserId, `${n.title}\n${n.body}\n\n${link}`, undefined, randomId);
        } catch (err) {
          if (err instanceof VkApiError && (err.code === 901 || err.code === 902)) {
            await db.vkAccount.update({ where: { userId: user.id }, data: { canMessage: false } });
            throw new SkipDelivery("vk messages not allowed");
          }
          throw err;
        }
        break;
      }
      case "EMAIL": {
        if (!user.emailVerifiedAt) throw new SkipDelivery("email not verified");
        await sendMail(notificationMail(user.email, n.title, n.body, n.url));
        break;
      }
      case "IN_APP":
        break;
    }
    await db.notificationDelivery.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 }, lockedUntil: null } });
  } catch (err) {
    if (err instanceof SkipDelivery) {
      await db.notificationDelivery.update({ where: { id }, data: { status: "SKIPPED", lastError: err.message, lockedUntil: null } });
      return;
    }
    const attempts = d.attempts + 1;
    const retryAfter = (err as Error & { retryAfter?: number }).retryAfter;
    const delayMs = retryAfter ? retryAfter * 1000 : (BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)] ?? 60) * 60_000;
    const failed = attempts >= MAX_ATTEMPTS;
    await db.notificationDelivery.update({
      where: { id },
      data: {
        attempts,
        status: failed ? "FAILED" : "PENDING",
        lastError: (err as Error).message.slice(0, 500),
        nextAttemptAt: new Date(Date.now() + delayMs),
        lockedUntil: null,
      },
    });
    log.warn("delivery failed", { id, channel: d.channel, attempts, failed, err: (err as Error).message });
  }
}

export async function processDeliveries(): Promise<number> {
  const ids = await claimBatch();
  for (const id of ids) {
    await deliver(id);
    // Мягкое ограничение скорости: Telegram ~30 msg/s, VK ~20 req/s.
    await new Promise((r) => setTimeout(r, 60));
  }
  return ids.length;
}
