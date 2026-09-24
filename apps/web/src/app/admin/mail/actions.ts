"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@drago/database";
import { audit, encryptSecret, generatePassword, getMailProvisioner, mailDomain, notify } from "@drago/core";
import { mailboxLocalPartSchema } from "@drago/shared";
import { userAction, UserError, zf } from "@/lib/actions";

const TEMP_SECRET_TTL_MS = 72 * 3600_000;

/**
 * Создание ящика name@dragotop.ru.
 * Временный пароль генерируется сервером, передаётся почтовому серверу и сохраняется
 * ТОЛЬКО в зашифрованном виде для одноразового показа владельцу в его кабинете.
 * Администратор пароль не видит.
 */
export const createMailbox = userAction(
  { permission: "mail.manage", schema: z.object({ userId: zf.id(), localPart: mailboxLocalPartSchema, quotaMb: zf.optInt(50, 51200) }) },
  async (d, { user, ip }) => {
    const target = await db.user.findUnique({ where: { id: d.userId }, include: { profile: true, emailAccount: true } });
    if (!target || target.status !== "ACTIVE") throw new UserError("Пользователь не найден или не активен");
    if (target.emailAccount) throw new UserError("У пользователя уже есть ящик");
    const address = `${d.localPart}@${mailDomain()}`;
    if (await db.emailAccount.findUnique({ where: { address } })) throw new UserError("Адрес занят", { localPart: "Адрес занят" });

    const provisioner = getMailProvisioner();
    const displayName = target.profile ? `${target.profile.firstName} ${target.profile.lastName}` : address;
    let status: "ACTIVE" | "PENDING" | "ERROR" = provisioner.automated ? "ACTIVE" : "PENDING";
    let lastError: string | null = null;
    let pendingSecretEnc: string | null = null;

    if (provisioner.automated) {
      const password = generatePassword();
      try {
        await provisioner.createMailbox({ address, displayName, password, quotaMb: d.quotaMb });
        pendingSecretEnc = encryptSecret(password);
      } catch (err) {
        status = "ERROR";
        lastError = (err as Error).message.slice(0, 500);
      }
    }
    const account = await db.emailAccount.create({
      data: {
        userId: target.id,
        address,
        provider: provisioner.kind,
        status,
        quotaMb: d.quotaMb ?? null,
        lastError,
        pendingSecretEnc,
        pendingSecretExpiresAt: pendingSecretEnc ? new Date(Date.now() + TEMP_SECRET_TTL_MS) : null,
        lastPasswordResetAt: pendingSecretEnc ? new Date() : null,
        createdById: user.id,
      },
    });
    await audit({ actorId: user.id, action: "mail.create", entity: "EmailAccount", entityId: account.id, ipAddress: ip, metadata: { address, provider: provisioner.kind, status } });
    if (status === "ACTIVE") {
      await notify({
        userIds: [target.id],
        type: "MAIL_READY",
        title: "Ваш ящик @dragotop.ru готов",
        body: `Адрес: ${address}. Временный пароль — в личном кабинете, раздел «Почта» (показывается один раз, 72 часа).`,
        url: "/cabinet/mail",
      });
    }
    revalidatePath("/admin/mail");
    if (status === "ERROR") throw new UserError(`Запись создана, но почтовый сервер вернул ошибку: ${lastError}`);
    return {
      ok: true,
      message: provisioner.automated
        ? `Ящик ${address} создан. Владелец получит временный пароль в кабинете.`
        : `Адрес ${address} зарезервирован. Создайте ящик в панели провайдера и отметьте его активным.`,
    };
  },
);

export const resetMailboxPassword = userAction({ permission: "mail.manage", schema: z.object({ id: zf.id() }) }, async (d, { user, ip }) => {
  const account = await db.emailAccount.findUnique({ where: { id: d.id } });
  if (!account) throw new UserError("Ящик не найден");
  const provisioner = getMailProvisioner();
  if (!provisioner.automated) throw new UserError("Ручной режим: сбросьте пароль в панели почтового провайдера (функция «пригласить/сбросить» у провайдера).");
  const password = generatePassword();
  try {
    // Отключённый ящик сначала разблокируем (ISPmanager различает блокировку и смену пароля).
    if (account.status === "DISABLED" && provisioner.enableMailbox) await provisioner.enableMailbox(account.address);
    await provisioner.setPassword(account.address, password);
  } catch (err) {
    await db.emailAccount.update({ where: { id: account.id }, data: { status: "ERROR", lastError: (err as Error).message.slice(0, 500) } });
    throw new UserError(`Почтовый сервер вернул ошибку: ${(err as Error).message.slice(0, 200)}`);
  }
  await db.emailAccount.update({
    where: { id: account.id },
    data: {
      status: "ACTIVE",
      lastError: null,
      pendingSecretEnc: encryptSecret(password),
      pendingSecretExpiresAt: new Date(Date.now() + TEMP_SECRET_TTL_MS),
      lastPasswordResetAt: new Date(),
    },
  });
  await audit({ actorId: user.id, action: "mail.password_reset", entity: "EmailAccount", entityId: account.id, ipAddress: ip, metadata: { address: account.address } });
  await notify({
    userIds: [account.userId],
    type: "MAIL_READY",
    title: "Новый временный пароль для почты",
    body: `Для ${account.address} выпущен новый временный пароль. Посмотрите его в кабинете, раздел «Почта».`,
    url: "/cabinet/mail",
  });
  revalidatePath("/admin/mail");
  return { ok: true, message: "Новый временный пароль отправлен владельцу в кабинет" };
});

export const setMailboxStatus = userAction(
  { permission: "mail.manage", schema: z.object({ id: zf.id(), status: z.enum(["ACTIVE", "DISABLED"]) }) },
  async (d, { user, ip }) => {
    const account = await db.emailAccount.findUnique({ where: { id: d.id } });
    if (!account) throw new UserError("Ящик не найден");
    const provisioner = getMailProvisioner();
    if (d.status === "DISABLED" && provisioner.automated) await provisioner.disableMailbox(account.address);
    if (d.status === "ACTIVE" && provisioner.automated) throw new UserError("Чтобы включить ящик, выпустите новый временный пароль");
    await db.emailAccount.update({ where: { id: account.id }, data: { status: d.status, pendingSecretEnc: null, pendingSecretExpiresAt: null } });
    await audit({ actorId: user.id, action: d.status === "DISABLED" ? "mail.disable" : "mail.activate", entity: "EmailAccount", entityId: account.id, ipAddress: ip, metadata: { address: account.address } });
    if (d.status === "ACTIVE") {
      await notify({ userIds: [account.userId], type: "MAIL_READY", title: "Ящик @dragotop.ru готов", body: `Адрес: ${account.address}. Пароль вам сообщит провайдер почты.`, url: "/cabinet/mail" });
    }
    revalidatePath("/admin/mail");
    return { ok: true, message: "Статус обновлён" };
  },
);

export const deleteMailbox = userAction({ permission: "mail.manage", schema: z.object({ id: zf.id() }) }, async (d, { user, ip }) => {
  const account = await db.emailAccount.findUnique({ where: { id: d.id } });
  if (!account) throw new UserError("Ящик не найден");
  const provisioner = getMailProvisioner();
  if (provisioner.automated) {
    try {
      await provisioner.deleteMailbox(account.address);
    } catch (err) {
      throw new UserError(`Почтовый сервер вернул ошибку: ${(err as Error).message.slice(0, 200)}`);
    }
  }
  await db.emailAccount.delete({ where: { id: account.id } });
  await audit({ actorId: user.id, action: "mail.delete", entity: "EmailAccount", entityId: account.id, ipAddress: ip, metadata: { address: account.address } });
  revalidatePath("/admin/mail");
  return { ok: true, message: "Ящик удалён" };
});
