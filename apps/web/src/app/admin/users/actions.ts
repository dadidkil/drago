"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@drago/database";
import { appUrl, audit, getMailProvisioner, invalidatePermissionCache, passwordResetMail, sendMail, verifyEmailMail } from "@drago/core";
import { emailSchema } from "@drago/shared";
import { userAction, UserError, zf } from "@/lib/actions";
import { revokeUserSessions } from "@/lib/auth/session";
import { issueAuthToken } from "@/lib/auth/tokens";
import { deleteFileAsset } from "@/lib/uploads";
import { assignableRole, createInvitedUser, manageableUser, sendInviteEmail } from "@/lib/users";

const nameRe = /^[A-Za-zА-Яа-яЁё\s'-]+$/;
const profileFields = {
  lastName: zf.str(1, 60, "Укажите фамилию").regex(nameRe, "Только буквы"),
  firstName: zf.str(1, 60, "Укажите имя").regex(nameRe, "Только буквы"),
  middleName: zf.optStr(60),
  position: zf.optStr(80),
  squadStatus: zf.optStr(40),
  joinedYear: zf.optInt(1990, 2100),
};

export const createUser = userAction(
  {
    permission: "users.manage",
    schema: z.object({ email: emailSchema, roleKey: z.string().max(30), sendInvite: zf.bool(), ...profileFields }),
  },
  async (d, { user, ip }) => {
    const { user: created, mailed } = await createInvitedUser(user, d, ip, d.sendInvite);
    redirect(`/admin/users/${created.id}?created=1${d.sendInvite && !mailed ? "&nomail=1" : ""}`);
  },
);

export const updateUser = userAction(
  {
    permission: "users.manage",
    schema: z.object({ userId: zf.id(), email: emailSchema, roleKey: z.string().max(30), status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED", "INVITED"]), phone: zf.optStr(30), ...profileFields }),
  },
  async (d, { user, ip }) => {
    const target = await manageableUser(user, d.userId);
    const changes: Record<string, unknown> = {};

    let roleId = target.roleId;
    if (d.roleKey !== target.role.key) {
      const role = await assignableRole(user, d.roleKey);
      roleId = role.id;
      changes.role = { from: target.role.key, to: role.key };
    }
    let status = target.status;
    if (d.status !== target.status) {
      if (d.status === "INVITED") throw new UserError("Статус «Приглашён» назначается автоматически");
      if (target.status === "INVITED" && d.status === "ACTIVE") throw new UserError("Пользователь станет активным после принятия приглашения");
      if (d.status !== "ACTIVE" && !user.can("users.delete")) throw new UserError("Нет права блокировать/архивировать пользователей");
      status = d.status;
      changes.status = { from: target.status, to: d.status };
    }
    let emailChanged = false;
    if (d.email !== target.email) {
      if (await db.user.findUnique({ where: { email: d.email } })) throw new UserError("Email уже используется", { email: "Email уже используется" });
      emailChanged = true;
      changes.email = true;
    }

    await db.user.update({
      where: { id: target.id },
      data: {
        roleId,
        status,
        ...(emailChanged ? { email: d.email, emailVerifiedAt: null } : {}),
        profile: {
          upsert: {
            create: { lastName: d.lastName, firstName: d.firstName, middleName: d.middleName, position: d.position, squadStatus: d.squadStatus, joinedYear: d.joinedYear, phone: d.phone },
            update: {
              lastName: d.lastName,
              firstName: d.firstName,
              middleName: d.middleName ?? null,
              position: d.position ?? null,
              squadStatus: d.squadStatus ?? null,
              joinedYear: d.joinedYear ?? null,
              phone: d.phone ?? null,
            },
          },
        },
      },
    });

    // Понижение роли, блокировка или смена email — завершаем сессии цели.
    if (changes.role || (changes.status && status !== "ACTIVE") || emailChanged) await revokeUserSessions(target.id);
    if (emailChanged && status === "ACTIVE") {
      const token = await issueAuthToken(target.id, "EMAIL_VERIFY");
      await sendMail(verifyEmailMail(d.email, appUrl(`/auth/verify-email?token=${token}`))).catch(() => undefined);
    }
    if (changes.role) {
      invalidatePermissionCache();
      await audit({ actorId: user.id, action: "user.role_change", entity: "User", entityId: target.id, ipAddress: ip, metadata: changes.role as object });
    }
    await audit({ actorId: user.id, action: "user.update", entity: "User", entityId: target.id, ipAddress: ip, metadata: { changed: Object.keys(changes) } });
    revalidatePath(`/admin/users/${target.id}`);
    return { ok: true, message: "Сохранено" };
  },
);

export const resendInvite = userAction({ permission: "users.manage", schema: z.object({ userId: zf.id() }) }, async (d, { user, ip }) => {
  await manageableUser(user, d.userId);
  const mailed = await sendInviteEmail(d.userId, user, ip);
  if (!mailed) throw new UserError("SMTP не настроен — письмо не отправлено. Используйте «Показать ссылку-приглашение».");
  return { ok: true, message: "Приглашение отправлено" };
});

/**
 * Ссылка-приглашение для передачи лично (если почта ещё не настроена).
 * Только для НЕактивированных аккаунтов — захватить активный аккаунт так нельзя. Действие журналируется.
 */
export const showInviteLink = userAction({ permission: "users.manage", schema: z.object({ userId: zf.id() }) }, async (d, { user, ip }) => {
  const target = await manageableUser(user, d.userId);
  if (target.status !== "INVITED") throw new UserError("Аккаунт уже активирован");
  const token = await issueAuthToken(target.id, "INVITE");
  await audit({ actorId: user.id, action: "user.invite_link_viewed", entity: "User", entityId: target.id, ipAddress: ip });
  return { ok: true, message: "Ссылка действует 72 часа. Передайте её лично владельцу аккаунта.", data: { link: appUrl(`/auth/invite?token=${token}`) } };
});

export const sendPasswordReset = userAction({ permission: "users.manage", schema: z.object({ userId: zf.id() }) }, async (d, { user, ip }) => {
  const target = await manageableUser(user, d.userId);
  if (target.status !== "ACTIVE") throw new UserError("Аккаунт не активен");
  const token = await issueAuthToken(target.id, "PASSWORD_RESET");
  await sendMail(passwordResetMail(target.email, appUrl(`/auth/reset?token=${token}`)));
  await audit({ actorId: user.id, action: "user.password_reset_sent", entity: "User", entityId: target.id, ipAddress: ip });
  return { ok: true, message: `Ссылка для сброса пароля отправлена на ${target.email}` };
});

export const revokeSessions = userAction({ permission: "users.manage", schema: z.object({ userId: zf.id() }) }, async (d, { user, ip }) => {
  const target = await manageableUser(user, d.userId);
  const count = await revokeUserSessions(target.id);
  await audit({ actorId: user.id, action: "user.sessions_revoked", entity: "User", entityId: target.id, ipAddress: ip, metadata: { count } });
  return { ok: true, message: `Завершено сессий: ${count}` };
});

export const reset2fa = userAction({ permission: "users.manage", schema: z.object({ userId: zf.id() }) }, async (d, { user, ip }) => {
  const target = await manageableUser(user, d.userId);
  await db.user.update({ where: { id: target.id }, data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, recoveryCodeHashes: [] } });
  await revokeUserSessions(target.id);
  await audit({ actorId: user.id, action: "user.2fa_reset", entity: "User", entityId: target.id, ipAddress: ip });
  return { ok: true, message: "2FA сброшена, сессии пользователя завершены" };
});

export const deleteUser = userAction(
  { permission: "users.delete", schema: z.object({ userId: zf.id(), confirmEmail: z.string().trim().toLowerCase() }) },
  async (d, { user, ip }) => {
    const target = await manageableUser(user, d.userId);
    if (d.confirmEmail !== target.email) throw new UserError("Введите email пользователя для подтверждения", { confirmEmail: "Не совпадает" });
    const avatar = target.profile?.avatarFileId;
    const mailbox = await db.emailAccount.findUnique({ where: { userId: target.id } });
    if (mailbox) {
      // Ящик в почтовом сервере удаляется вместе с аккаунтом (минимизация данных).
      await getMailProvisioner()
        .deleteMailbox(mailbox.address)
        .catch((err: Error) => audit({ actorId: user.id, action: "mail.delete_failed", entity: "EmailAccount", entityId: mailbox.id, metadata: { error: err.message.slice(0, 200) } }));
    }
    await db.user.delete({ where: { id: target.id } });
    if (avatar) await deleteFileAsset(avatar).catch(() => undefined);
    await audit({ actorId: user.id, action: "user.delete", entity: "User", entityId: target.id, ipAddress: ip, metadata: { role: target.role.key } });
    redirect("/admin/users?deleted=1");
  },
);
