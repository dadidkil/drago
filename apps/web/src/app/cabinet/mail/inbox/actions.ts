"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@drago/database";
import { audit, checkCredentials, getSetting, sendAs, trashMessage } from "@drago/core";
import { userAction, UserError } from "@/lib/actions";
import { clearMailboxSession, mailboxCreds, saveMailboxSession } from "./creds";

/** Вход в почту: пароль проверяем у самого почтового сервера и кладём в зашифрованную куку. */
export const unlockMailbox = userAction({ schema: z.object({ password: z.string().min(1, "Введите пароль ящика") }) }, async (d, { user, ip }) => {
  const [account, mail] = await Promise.all([db.emailAccount.findUnique({ where: { userId: user.id } }), getSetting("mail")]);
  if (!account || account.status !== "ACTIVE") throw new UserError("Ящик недоступен. Напишите командиру.");
  const ok = await checkCredentials({
    address: account.address,
    password: d.password,
    imapHost: mail.imapHost || mail.domain,
    smtpHost: mail.smtpHost || mail.domain,
  });
  if (!ok) throw new UserError("Почтовый сервер не принял пароль", { password: "Неверный пароль" });
  await saveMailboxSession(user.id, d.password);
  await audit({ actorId: user.id, action: "mail.webmail_unlock", entity: "EmailAccount", entityId: account.id, ipAddress: ip });
  revalidatePath("/cabinet/mail/inbox");
  return { ok: true, message: "Почта открыта" };
});

export const lockMailbox = userAction({ schema: z.object({}) }, async () => {
  await clearMailboxSession();
  revalidatePath("/cabinet/mail/inbox");
  return { ok: true, message: "Почта закрыта" };
});

export const sendMessage = userAction(
  {
    schema: z.object({
      to: z.string().trim().min(3, "Укажите получателя").max(200),
      subject: z.string().trim().max(200).default(""),
      text: z.string().trim().min(1, "Напишите текст письма").max(20000),
      inReplyTo: z.string().trim().max(200).optional(),
    }),
  },
  async (d, { user, ip }) => {
    const creds = await mailboxCreds(user.id);
    if (!creds) throw new UserError("Сначала введите пароль от ящика");
    try {
      await sendAs(creds, { to: d.to, subject: d.subject || "(без темы)", text: d.text, inReplyTo: d.inReplyTo });
    } catch (err) {
      throw new UserError(`Письмо не ушло: ${(err as Error).message.slice(0, 160)}`);
    }
    await audit({ actorId: user.id, action: "mail.webmail_send", entity: "EmailAccount", entityId: creds.address, ipAddress: ip, metadata: { to: d.to } });
    revalidatePath("/cabinet/mail/inbox");
    return { ok: true, message: "Письмо отправлено" };
  },
);

export const deleteMessage = userAction({ schema: z.object({ uid: z.coerce.number().int().positive() }) }, async (d, { user }) => {
  const creds = await mailboxCreds(user.id);
  if (!creds) throw new UserError("Сначала введите пароль от ящика");
  await trashMessage(creds, d.uid);
  revalidatePath("/cabinet/mail/inbox");
  return { ok: true, message: "Письмо в корзине" };
});
