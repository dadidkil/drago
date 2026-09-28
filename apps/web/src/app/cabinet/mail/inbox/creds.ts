import "server-only";
import { db } from "@drago/database";
import { inboxStatus, mailboxAccess, type MailboxAccess } from "@drago/core";

/**
 * Вход в почту без пароля: служебный пароль ящика хранится зашифрованным на сервере
 * (packages/core/src/mail/access.ts) и никому не показывается.
 */
export async function mailboxCreds(userId: string, opts: { verify?: boolean } = {}): Promise<MailboxAccess> {
  return mailboxAccess(userId, opts);
}

/** Обновить счётчик непрочитанных (бейдж «Почта» в меню) после чтения/удаления писем. */
export async function refreshUnread(userId: string): Promise<void> {
  const access = await mailboxAccess(userId);
  if (!access.ok) return;
  try {
    const st = await inboxStatus(access.creds);
    await db.emailAccount.update({ where: { userId }, data: { unreadCount: st.unseen, mailCheckedAt: new Date() } });
  } catch {
    /* сервер недоступен — счётчик обновит воркер */
  }
}
