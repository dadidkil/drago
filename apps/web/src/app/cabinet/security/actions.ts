"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@drago/database";
import { audit, createLinkCode, getSetting, rateLimit } from "@drago/core";
import { passwordSchema, totpCodeSchema } from "@drago/shared";
import { userAction, UserError, zf } from "@/lib/actions";
import type { CurrentUser } from "@/lib/auth/current-user";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { revokeUserSessions } from "@/lib/auth/session";
import { generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, verifyTotp } from "@/lib/auth/totp";

async function checkPassword(user: CurrentUser, password: string) {
  const limit = await rateLimit(`reauth:${user.id}`, 5, 900);
  if (!limit.ok) throw new UserError("Слишком много попыток. Попробуйте позже.");
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row.passwordHash || !(await verifyPassword(row.passwordHash, password))) {
    throw new UserError("Неверный текущий пароль", { currentPassword: "Неверный пароль" });
  }
}

export const changePassword = userAction(
  {
    schema: z
      .object({ currentPassword: z.string().min(1, "Введите текущий пароль").max(128), password: passwordSchema, confirm: z.string() })
      .refine((d) => d.password === d.confirm, { message: "Пароли не совпадают", path: ["confirm"] }),
  },
  async (d, { user, ip }) => {
    await checkPassword(user, d.currentPassword);
    if (d.password.toLowerCase().includes(user.email.split("@")[0]!.toLowerCase())) {
      throw new UserError("Пароль не должен содержать email", { password: "Пароль не должен содержать email" });
    }
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(d.password) } });
    const revoked = await revokeUserSessions(user.id, user.session.id);
    await audit({ actorId: user.id, action: "auth.password_changed", entity: "User", entityId: user.id, ipAddress: ip, metadata: { revokedSessions: revoked } });
    return { ok: true, message: "Пароль изменён. Остальные сессии завершены." };
  },
);

export const revokeSession = userAction({ schema: z.object({ sessionId: zf.id() }) }, async (d, { user, ip }) => {
  if (d.sessionId === user.session.id) throw new UserError("Чтобы завершить текущую сессию, нажмите «Выйти»");
  await db.session.deleteMany({ where: { id: d.sessionId, userId: user.id } });
  await audit({ actorId: user.id, action: "auth.session_revoked", entity: "Session", entityId: d.sessionId, ipAddress: ip });
  revalidatePath("/cabinet/security");
  return { ok: true, message: "Сессия завершена" };
});

export const revokeOtherSessions = userAction({ schema: z.object({}) }, async (_d, { user, ip }) => {
  const count = await revokeUserSessions(user.id, user.session.id);
  await audit({ actorId: user.id, action: "auth.sessions_revoked", entity: "User", entityId: user.id, ipAddress: ip, metadata: { count } });
  revalidatePath("/cabinet/security");
  return { ok: true, message: `Завершено сессий: ${count}` };
});

// ── 2FA ─────────────────────────────────────────────────────────────────

export const startTotpSetup = userAction({ schema: z.object({}) }, async (_d, { user }) => {
  if (user.has2fa) throw new UserError("2FA уже включена");
  const { encrypted } = generateTotpSecret();
  await db.user.update({ where: { id: user.id }, data: { totpSecretEnc: encrypted, totpEnabledAt: null, totpLastStep: null } });
  revalidatePath("/cabinet/security");
  return { ok: true };
});

export const confirmTotpSetup = userAction({ schema: z.object({ code: z.string().trim().regex(/^\d{6}$/, "Введите 6 цифр") }) }, async (d, { user, ip }) => {
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpSecretEnc: true, totpEnabledAt: true } });
  if (!row.totpSecretEnc || row.totpEnabledAt) throw new UserError("Начните настройку заново");
  const limit = await rateLimit(`totp-setup:${user.id}`, 10, 900);
  if (!limit.ok) throw new UserError("Слишком много попыток. Попробуйте позже.");
  const step = verifyTotp(row.totpSecretEnc, d.code, null);
  if (step === null) throw new UserError("Код не подошёл. Проверьте время на телефоне и попробуйте ещё раз.", { code: "Неверный код" });
  const { codes, hashes } = generateRecoveryCodes();
  await db.user.update({ where: { id: user.id }, data: { totpEnabledAt: new Date(), totpLastStep: step, recoveryCodeHashes: hashes } });
  // Текущая сессия уже подтверждена паролем + кодом — отмечаем её как прошедшую 2FA.
  await db.session.update({ where: { id: user.session.id }, data: { twoFactorVerified: true } });
  await audit({ actorId: user.id, action: "auth.2fa_enabled", entity: "User", entityId: user.id, ipAddress: ip });
  return { ok: true, message: "Двухфакторная аутентификация включена", data: { recoveryCodes: codes } };
});

export const disableTotp = userAction(
  { schema: z.object({ currentPassword: z.string().min(1).max(128), code: totpCodeSchema }) },
  async (d, { user, ip }) => {
    if (!user.has2fa) throw new UserError("2FA не включена");
    if (user.level >= 40 && (await getSetting("security")).requireStaff2fa) {
      throw new UserError("Для командного состава 2FA обязательна. Можно перевыпустить резервные коды или перенастроить приложение через администратора.");
    }
    await checkPassword(user, d.currentPassword);
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpSecretEnc: true, totpLastStep: true, recoveryCodeHashes: true } });
    const ok = /^\d{6}$/.test(d.code) ? verifyTotp(row.totpSecretEnc!, d.code, row.totpLastStep) !== null : row.recoveryCodeHashes.includes(hashRecoveryCode(d.code));
    if (!ok) throw new UserError("Неверный код", { code: "Неверный код" });
    await db.user.update({ where: { id: user.id }, data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, recoveryCodeHashes: [] } });
    await audit({ actorId: user.id, action: "auth.2fa_disabled", entity: "User", entityId: user.id, ipAddress: ip });
    revalidatePath("/cabinet/security");
    return { ok: true, message: "2FA отключена" };
  },
);

export const regenerateRecoveryCodes = userAction({ schema: z.object({ code: z.string().trim().regex(/^\d{6}$/, "Введите 6 цифр") }) }, async (d, { user, ip }) => {
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpSecretEnc: true, totpLastStep: true } });
  if (!row.totpSecretEnc || !user.has2fa) throw new UserError("2FA не включена");
  const step = verifyTotp(row.totpSecretEnc, d.code, row.totpLastStep);
  if (step === null) throw new UserError("Неверный код", { code: "Неверный код" });
  const { codes, hashes } = generateRecoveryCodes();
  await db.user.update({ where: { id: user.id }, data: { recoveryCodeHashes: hashes, totpLastStep: step } });
  await audit({ actorId: user.id, action: "auth.recovery_codes_regenerated", entity: "User", entityId: user.id, ipAddress: ip });
  return { ok: true, message: "Новые резервные коды — старые больше не действуют", data: { recoveryCodes: codes } };
});

// ── Мессенджеры ─────────────────────────────────────────────────────────

export const startTelegramLink = userAction({ schema: z.object({}) }, async (_d, { user }) => {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || (await getSetting("integrations")).telegramBotUsername;
  if (!botUsername) throw new UserError("Telegram-бот ещё не настроен администратором");
  const { code } = await createLinkCode(user.id, "TELEGRAM");
  return { ok: true, data: { url: `https://t.me/${botUsername.replace(/^@/, "")}?start=link_${code}` } };
});

export const startVkLink = userAction({ schema: z.object({}) }, async (_d, { user }) => {
  const { code } = await createLinkCode(user.id, "VK");
  const vkUrl = (await getSetting("site.contacts")).vkUrl;
  const screen = vkUrl.replace(/^https?:\/\/(m\.)?vk\.(com|ru)\//, "");
  return { ok: true, data: { code, url: screen ? `https://vk.me/${screen}` : "" } };
});

export const unlinkMessenger = userAction({ schema: z.object({ channel: z.enum(["TELEGRAM", "VK"]) }) }, async (d, { user, ip }) => {
  if (d.channel === "TELEGRAM") await db.telegramAccount.deleteMany({ where: { userId: user.id } });
  else await db.vkAccount.deleteMany({ where: { userId: user.id } });
  await audit({ actorId: user.id, action: `integration.${d.channel.toLowerCase()}_unlinked`, entity: "User", entityId: user.id, ipAddress: ip });
  revalidatePath("/cabinet/security");
  return { ok: true, message: "Отвязано" };
});
