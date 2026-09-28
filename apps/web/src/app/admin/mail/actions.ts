"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@drago/database";
import { audit, encryptSecret, generatePassword, getMailProvisioner, mailDomain, notify } from "@drago/core";
import { fullName, mailboxLocalPartSchema, suggestMailbox } from "@drago/shared";
import { userAction, UserError, zf } from "@/lib/actions";


/**
 * Создание ящика name@dragotop.ru.
 * Временный пароль генерируется сервером, передаётся почтовому серверу и сохраняется
 * ТОЛЬКО в зашифрованном виде для одноразового показа владельцу в его кабинете.
 * Администратор пароль не видит.
 */
async function provisionMailbox(d: { userId: string; localPart: string; quotaMb?: number }, user: { id: string }, ip: string | null) {
  {
    const target = await db.user.findUnique({ where: { id: d.userId }, include: { profile: true, emailAccount: true } });
    if (!target || target.status !== "ACTIVE") throw new UserError("Пользователь не найден или не активен");
    if (target.emailAccount) throw new UserError("У пользователя уже есть ящик");
    const address = `${d.localPart}@${mailDomain()}`;
    if (await db.emailAccount.findUnique({ where: { address } })) throw new UserError("Адрес занят", { localPart: "Адрес занят" });

    const provisioner = getMailProvisioner();
    const displayName = target.profile ? `${target.profile.firstName} ${target.profile.lastName}` : address;
    let status: "ACTIVE" | "PENDING" | "ERROR" = provisioner.automated ? "ACTIVE" : "PENDING";
    let lastError: string | null = null;
    let passwordEnc: string | null = null;

    if (provisioner.automated) {
      // Пароль служебный: кабинет входит в почту сам, никто его не видит и не вводит.
      const password = generatePassword();
      try {
        await provisioner.createMailbox({ address, displayName, password, quotaMb: d.quotaMb });
        passwordEnc = encryptSecret(password);
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
        passwordEnc,
        lastPasswordResetAt: passwordEnc ? new Date() : null,
        createdById: user.id,
      },
    });
    await audit({ actorId: user.id, action: "mail.create", entity: "EmailAccount", entityId: account.id, ipAddress: ip, metadata: { address, provider: provisioner.kind, status } });
    if (status === "ACTIVE") {
      await notify({
        userIds: [target.id],
        type: "MAIL_READY",
        title: "Ваш ящик @dragotop.ru готов",
        body: `Адрес: ${address}. Почта открывается прямо в кабинете, раздел «Почта» — без пароля.`,
        url: "/cabinet/mail",
      });
    }
    if (status === "ERROR") throw new UserError(`Запись создана, но почтовый сервер вернул ошибку: ${lastError}`);
    return address;
  }
}

/** Создание одного ящика из формы. */
export const createMailbox = userAction(
  { permission: "mail.manage", schema: z.object({ userId: zf.id(), localPart: mailboxLocalPartSchema, quotaMb: zf.optInt(50, 51200) }) },
  async (d, { user, ip }) => {
    const address = await provisionMailbox(d, user, ip);
    revalidatePath("/admin/mail");
    const provisioner = getMailProvisioner();
    return {
      ok: true,
      message: provisioner.automated
        ? `Ящик ${address} создан. Владелец откроет его в кабинете без пароля.`
        : `Адрес ${address} зарезервирован. Создайте ящик в панели провайдера и отметьте его активным.`,
    };
  },
);

/**
 * Пакетное создание: отмечаем сразу нескольких человек, адреса берём из их ФИО.
 * Ошибка на одном не отменяет остальных — иначе на десяти бойцах любая мелочь
 * заставляла бы начинать сначала; итог возвращаем построчно.
 */
export const createMailboxesBulk = userAction(
  { permission: "mail.manage", schema: z.object({ userIds: z.array(zf.id()).min(1, "Отметьте хотя бы одного"), quotaMb: zf.optInt(50, 51200) }) },
  async (d, { user, ip }) => {
    const done: string[] = [];
    const failed: string[] = [];
    for (const userId of d.userIds) {
      const target = await db.user.findUnique({ where: { id: userId }, include: { profile: true } });
      const name = target?.profile ? fullName(target.profile) : (target?.email ?? userId);
      if (!target?.profile) {
        failed.push(`${name}: нет профиля, адрес не из чего собрать`);
        continue;
      }
      let localPart = suggestMailbox(target.profile.firstName, target.profile.lastName);
      // Тёзки: добираем цифру, пока адрес свободен.
      for (let n = 2; await db.emailAccount.findUnique({ where: { address: `${localPart}@${mailDomain()}` } }); n++) {
        localPart = `${suggestMailbox(target.profile.firstName, target.profile.lastName)}${n}`;
      }
      try {
        done.push(await provisionMailbox({ userId, localPart, quotaMb: d.quotaMb }, user, ip));
      } catch (err) {
        failed.push(`${name}: ${(err as Error).message.slice(0, 120)}`);
      }
    }
    revalidatePath("/admin/mail");
    if (done.length === 0) throw new UserError(`Ни одного ящика не создано. ${failed.join("; ")}`);
    return {
      ok: true,
      message: `Создано ящиков: ${done.length} (${done.join(", ")}).${failed.length ? ` Не вышло: ${failed.join("; ")}` : ""}`,
    };
  },
);

/**
 * Передача ящика другому человеку: адрес остаётся, меняется владелец.
 * Пароль обязательно перевыпускаем — иначе прежний владелец продолжит читать чужую переписку.
 */
export const transferMailbox = userAction(
  { permission: "mail.manage", schema: z.object({ id: zf.id(), toUserId: zf.id() }) },
  async (d, { user, ip }) => {
    const account = await db.emailAccount.findUnique({ where: { id: d.id }, include: { user: { include: { profile: true } } } });
    if (!account) throw new UserError("Ящик не найден");
    if (account.userId === d.toUserId) throw new UserError("Этот ящик уже принадлежит выбранному человеку");
    const target = await db.user.findUnique({ where: { id: d.toUserId }, include: { profile: true, emailAccount: true } });
    if (!target || target.status !== "ACTIVE") throw new UserError("Новый владелец не найден или не активен");
    if (target.emailAccount) throw new UserError("У нового владельца уже есть ящик");

    const provisioner = getMailProvisioner();
    let passwordEnc: string | null = null;
    if (provisioner.automated) {
      const password = generatePassword();
      try {
        await provisioner.setPassword(account.address, password);
        passwordEnc = encryptSecret(password);
      } catch (err) {
        throw new UserError(`Почтовый сервер вернул ошибку: ${(err as Error).message.slice(0, 200)}`);
      }
    }
    await db.emailAccount.update({
      where: { id: account.id },
      data: {
        userId: target.id,
        passwordEnc,
        pendingSecretEnc: null,
        pendingSecretExpiresAt: null,
        unreadCount: 0,
        lastUidNext: null,
        lastPasswordResetAt: passwordEnc ? new Date() : account.lastPasswordResetAt,
      },
    });
    await audit({
      actorId: user.id,
      action: "mail.transfer",
      entity: "EmailAccount",
      entityId: account.id,
      ipAddress: ip,
      metadata: { address: account.address, from: account.userId, to: target.id },
    });
    await notify({
      userIds: [target.id],
      type: "MAIL_READY",
      title: `Вам передан ящик ${account.address}`,
      body: provisioner.automated ? "Почта уже открывается в кабинете, раздел «Почта»." : "Пароль вам сообщит командный состав.",
      url: "/cabinet/mail",
    });
    await notify({
      userIds: [account.userId],
      type: "MAIL_READY",
      title: `Ящик ${account.address} больше не ваш`,
      body: `Ящик передан другому бойцу, пароль изменён. Если это ошибка — напишите командиру.`,
      url: "/cabinet/mail",
    });
    revalidatePath("/admin/mail");
    return { ok: true, message: `Ящик ${account.address} передан. Новый владелец откроет его в кабинете, у прежнего доступа больше нет.` };
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
    data: { status: "ACTIVE", lastError: null, passwordEnc: encryptSecret(password), pendingSecretEnc: null, pendingSecretExpiresAt: null, lastPasswordResetAt: new Date() },
  });
  await audit({ actorId: user.id, action: "mail.password_reset", entity: "EmailAccount", entityId: account.id, ipAddress: ip, metadata: { address: account.address } });
  await notify({
    userIds: [account.userId],
    type: "MAIL_READY",
    title: "Доступ к почте обновлён",
    body: `Ящик ${account.address} снова открывается в кабинете, раздел «Почта».`,
    url: "/cabinet/mail",
  });
  revalidatePath("/admin/mail");
  return { ok: true, message: "Доступ перевыпущен — владелец открывает почту в кабинете" };
});

export const setMailboxStatus = userAction(
  { permission: "mail.manage", schema: z.object({ id: zf.id(), status: z.enum(["ACTIVE", "DISABLED"]) }) },
  async (d, { user, ip }) => {
    const account = await db.emailAccount.findUnique({ where: { id: d.id } });
    if (!account) throw new UserError("Ящик не найден");
    const provisioner = getMailProvisioner();
    if (d.status === "DISABLED" && provisioner.automated) await provisioner.disableMailbox(account.address);
    if (d.status === "ACTIVE" && provisioner.automated) throw new UserError("Чтобы включить ящик, нажмите «Перевыпустить доступ»");
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
