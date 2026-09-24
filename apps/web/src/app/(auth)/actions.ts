"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@drago/database";
import { audit, passwordResetMail, rateLimit, resetRateLimit, sendMail, sha256, appUrl } from "@drago/core";
import { emailSchema, loginSchema, passwordSchema, totpCodeSchema } from "@drago/shared";
import { publicAction, UserError, type ActionState } from "@/lib/actions";
import { hashPassword, verifyDummy, verifyPassword } from "@/lib/auth/password";
import { createSession, destroyCurrentSession, getSession, revokeUserSessions, rotateSession } from "@/lib/auth/session";
import { hashRecoveryCode, verifyTotp } from "@/lib/auth/totp";
import { consumeAuthToken, issueAuthToken } from "@/lib/auth/tokens";
import { getClientIp, getUserAgent } from "@/lib/request";

const GENERIC_LOGIN_ERROR = "Неверный email или пароль";
const MAX_FAILED = 10;
const LOCK_MINUTES = 30;

function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/cabinet";
  return next.slice(0, 200);
}

export const login = publicAction({ schema: loginSchema.extend({ next: z.string().optional() }) }, async (data, { ip }) => {
  const emailKey = sha256(data.email);
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`login:ip:${ip ?? "unknown"}`, 30, 600),
    rateLimit(`login:email:${emailKey}`, 8, 900),
  ]);
  if (!byIp.ok || !byEmail.ok) {
    const minutes = Math.ceil(Math.max(byIp.retryAfterSec, byEmail.retryAfterSec) / 60);
    throw new UserError(`Слишком много попыток входа. Попробуйте через ${minutes} мин.`);
  }

  const user = await db.user.findUnique({ where: { email: data.email } });
  if (!user || !user.passwordHash) {
    await verifyDummy(data.password);
    throw new UserError(GENERIC_LOGIN_ERROR);
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await verifyDummy(data.password);
    throw new UserError("Слишком много попыток входа. Попробуйте позже.");
  }

  const valid = await verifyPassword(user.passwordHash, data.password);
  if (!valid) {
    const failed = user.failedLoginCount + 1;
    await db.user.update({
      where: { id: user.id },
      data:
        failed >= MAX_FAILED
          ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
          : { failedLoginCount: failed },
    });
    await audit({ actorId: user.id, action: "auth.login_failed", entity: "User", entityId: user.id, ipAddress: ip, metadata: { failed } });
    throw new UserError(GENERIC_LOGIN_ERROR);
  }

  if (user.status !== "ACTIVE") {
    throw new UserError(user.status === "INVITED" ? "Завершите регистрацию по ссылке из письма-приглашения" : "Доступ к аккаунту ограничен. Обратитесь к командиру.");
  }

  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await resetRateLimit(`login:email:${emailKey}`);
  const needs2fa = Boolean(user.totpEnabledAt);
  await createSession(user.id, { twoFactorVerified: !needs2fa, ipAddress: ip, userAgent: await getUserAgent() });
  await audit({ actorId: user.id, action: "auth.login", entity: "User", entityId: user.id, ipAddress: ip, metadata: { needs2fa } });

  const next = safeNext(data.next);
  redirect(needs2fa ? `/auth/2fa?next=${encodeURIComponent(next)}` : next);
});

export const verifySecondFactor = publicAction(
  { schema: z.object({ code: totpCodeSchema, next: z.string().optional() }) },
  async (data, { ip }) => {
    const session = await getSession();
    if (!session || !session.user.totpEnabledAt || !session.user.totpSecretEnc) redirect("/login");
    if (session.twoFactorVerified) redirect(safeNext(data.next));

    const limit = await rateLimit(`2fa:${session.id}`, 6, 300);
    if (!limit.ok) {
      await destroyCurrentSession();
      await audit({ actorId: session.userId, action: "auth.2fa_locked", entity: "User", entityId: session.userId, ipAddress: ip });
      throw new UserError("Слишком много неверных кодов. Войдите заново.");
    }

    const user = session.user;
    let method: "totp" | "recovery" | null = null;
    if (/^\d{6}$/.test(data.code)) {
      const step = verifyTotp(user.totpSecretEnc!, data.code, user.totpLastStep);
      if (step !== null) {
        await db.user.update({ where: { id: user.id }, data: { totpLastStep: step } });
        method = "totp";
      }
    } else {
      const hash = hashRecoveryCode(data.code);
      if (user.recoveryCodeHashes.includes(hash)) {
        await db.user.update({
          where: { id: user.id },
          data: { recoveryCodeHashes: user.recoveryCodeHashes.filter((h) => h !== hash) },
        });
        method = "recovery";
      }
    }
    if (!method) {
      await audit({ actorId: user.id, action: "auth.2fa_failed", entity: "User", entityId: user.id, ipAddress: ip });
      throw new UserError("Неверный код");
    }

    await rotateSession(session.id, user.id, { twoFactorVerified: true, ipAddress: ip, userAgent: await getUserAgent() });
    await audit({ actorId: user.id, action: "auth.2fa_verified", entity: "User", entityId: user.id, ipAddress: ip, metadata: { method } });
    redirect(safeNext(data.next));
  },
);

const FORGOT_MESSAGE = "Если аккаунт с таким email существует, мы отправили на него ссылку для сброса пароля.";

export const requestPasswordReset = publicAction({ schema: z.object({ email: emailSchema }) }, async (data, { ip }) => {
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`forgot:ip:${ip ?? "unknown"}`, 10, 3600),
    rateLimit(`forgot:email:${sha256(data.email)}`, 3, 3600),
  ]);
  if (!byIp.ok) throw new UserError("Слишком много запросов. Попробуйте позже.");
  // Одинаковый ответ независимо от существования аккаунта (защита от перечисления).
  if (!byEmail.ok) return { ok: true, message: FORGOT_MESSAGE };

  const user = await db.user.findUnique({ where: { email: data.email } });
  if (user && user.status === "ACTIVE") {
    const token = await issueAuthToken(user.id, "PASSWORD_RESET");
    await sendMail(passwordResetMail(user.email, appUrl(`/auth/reset?token=${token}`)));
    await audit({ actorId: user.id, action: "auth.password_reset_requested", entity: "User", entityId: user.id, ipAddress: ip });
  }
  return { ok: true, message: FORGOT_MESSAGE };
});

const newPasswordSchema = z
  .object({ token: z.string().min(20).max(100), password: passwordSchema, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "Пароли не совпадают", path: ["confirm"] });

export const resetPassword = publicAction({ schema: newPasswordSchema }, async (data, { ip }) => {
  const userId = await consumeAuthToken(data.token, "PASSWORD_RESET");
  if (!userId) throw new UserError("Ссылка недействительна или устарела. Запросите новую.");
  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(data.password),
      emailVerifiedAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  await revokeUserSessions(userId);
  await audit({ actorId: userId, action: "auth.password_reset", entity: "User", entityId: userId, ipAddress: ip });
  redirect("/login?reset=1");
});

export const acceptInvite = publicAction({ schema: newPasswordSchema }, async (data, { ip }) => {
  const userId = await consumeAuthToken(data.token, "INVITE");
  if (!userId) throw new UserError("Приглашение недействительно или устарело. Попросите командира отправить новое.");
  const user = await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(data.password), status: "ACTIVE", emailVerifiedAt: new Date() },
  });
  await revokeUserSessions(userId);
  await createSession(user.id, { twoFactorVerified: true, ipAddress: ip, userAgent: await getUserAgent() });
  await audit({ actorId: userId, action: "auth.invite_accepted", entity: "User", entityId: userId, ipAddress: ip });
  redirect("/cabinet?welcome=1");
});

export const confirmEmail = publicAction({ schema: z.object({ token: z.string().min(20).max(100) }) }, async (data, { ip }) => {
  const userId = await consumeAuthToken(data.token, "EMAIL_VERIFY");
  if (!userId) throw new UserError("Ссылка недействительна или устарела.");
  await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  await audit({ actorId: userId, action: "auth.email_verified", entity: "User", entityId: userId, ipAddress: ip });
  return { ok: true, message: "Email подтверждён. Спасибо!" };
});

export async function logout(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (session) {
    await audit({ actorId: session.userId, action: "auth.logout", entity: "User", entityId: session.userId, ipAddress: await getClientIp() });
  }
  await destroyCurrentSession();
  redirect("/");
}
