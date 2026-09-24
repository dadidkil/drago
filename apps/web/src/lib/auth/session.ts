import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@drago/database";
import { randomToken, sha256 } from "@drago/core/crypto";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-drago_session" : "drago_session";
/** Неактивность, после которой сессия истекает. */
const IDLE_MS = 14 * 24 * 3600_000;
/** Абсолютный срок жизни сессии — после него нужен повторный вход. */
const ABSOLUTE_MS = 30 * 24 * 3600_000;
/** Как часто обновлять lastSeenAt/expiresAt (чтобы не писать в БД на каждый запрос). */
const TOUCH_INTERVAL_MS = 15 * 60_000;

export interface SessionMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
  twoFactorVerified: boolean;
}

/**
 * Новая сессия. Всегда новый случайный токен (защита от session fixation).
 * В БД хранится только SHA-256 токена.
 */
export async function createSession(userId: string, meta: SessionMeta): Promise<void> {
  const token = randomToken(32);
  const now = Date.now();
  await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      twoFactorVerified: meta.twoFactorVerified,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
      expiresAt: new Date(now + IDLE_MS),
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ABSOLUTE_MS / 1000),
  });
}

export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        include: {
          role: { select: { id: true, key: true, name: true, level: true } },
          profile: true,
        },
      },
    },
  });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() < now || session.createdAt.getTime() + ABSOLUTE_MS < now) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(now), expiresAt: new Date(Math.min(now + IDLE_MS, session.createdAt.getTime() + ABSOLUTE_MS)) },
      })
      .catch(() => undefined);
  }
  return session;
});

export type CurrentSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/** Завершает текущую сессию (выход). */
export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Ротация после подтверждения 2FA: старая сессия удаляется, выдаётся новая. */
export async function rotateSession(oldSessionId: string, userId: string, meta: SessionMeta): Promise<void> {
  await db.session.delete({ where: { id: oldSessionId } }).catch(() => undefined);
  await createSession(userId, meta);
}

/** Завершить все сессии пользователя (кроме, опционально, текущей). */
export async function revokeUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const res = await db.session.deleteMany({ where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });
  return res.count;
}
