"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, sendAs, trashMessage } from "@drago/core";
import { userAction, UserError } from "@/lib/actions";
import { mailboxCreds, refreshUnread } from "./creds";

async function creds(userId: string) {
  const access = await mailboxCreds(userId);
  if (!access.ok) throw new UserError(access.message);
  return access.creds;
}

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
    const c = await creds(user.id);
    try {
      await sendAs(c, { to: d.to, subject: d.subject || "(без темы)", text: d.text, inReplyTo: d.inReplyTo });
    } catch (err) {
      throw new UserError(`Письмо не ушло: ${(err as Error).message.slice(0, 160)}`);
    }
    await audit({ actorId: user.id, action: "mail.webmail_send", entity: "EmailAccount", entityId: c.address, ipAddress: ip, metadata: { to: d.to } });
    revalidatePath("/cabinet/mail/inbox");
    return { ok: true, message: "Письмо отправлено" };
  },
);

export const deleteMessage = userAction({ schema: z.object({ uid: z.coerce.number().int().positive() }) }, async (d, { user }) => {
  await trashMessage(await creds(user.id), d.uid);
  await refreshUnread(user.id);
  revalidatePath("/cabinet", "layout");
  return { ok: true, message: "Письмо в корзине" };
});
