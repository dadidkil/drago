import "server-only";
import { cookies } from "next/headers";
import { db } from "@drago/database";
import { decryptSecret, encryptSecret, getSetting, type MailboxCreds } from "@drago/core";

/**
 * Пароль от ящика нужен на каждый запрос к IMAP, но хранить его на сервере нельзя:
 * весь смысл корпоративной почты в том, что пароль знает только владелец.
 * Компромисс — зашифрованная httpOnly-кука на время рабочего дня: она уезжает к клиенту,
 * расшифровать её может только сервер (APP_ENCRYPTION_KEY), а в базе не остаётся ничего.
 */
const COOKIE = "drago_mailbox";
const TTL_SECONDS = 8 * 3600;

export async function saveMailboxSession(userId: string, password: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, encryptSecret(`${userId}:${password}`), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/cabinet/mail",
    maxAge: TTL_SECONDS,
  });
}

export async function clearMailboxSession(): Promise<void> {
  const jar = await cookies();
  jar.delete({ name: COOKIE, path: "/cabinet/mail" });
}

/** Доступ к ящику текущего пользователя или null, если пароль ещё не вводили. */
export async function mailboxCreds(userId: string): Promise<MailboxCreds | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  let decoded: string;
  try {
    decoded = decryptSecret(raw);
  } catch {
    return null;
  }
  const sep = decoded.indexOf(":");
  if (sep < 0) return null;
  // Кука привязана к пользователю: чужая сессия в том же браузере чужой ящик не откроет.
  if (decoded.slice(0, sep) !== userId) return null;
  const password = decoded.slice(sep + 1);

  const [account, mail] = await Promise.all([db.emailAccount.findUnique({ where: { userId } }), getSetting("mail")]);
  if (!account || account.status !== "ACTIVE") return null;
  return {
    address: account.address,
    password,
    imapHost: mail.imapHost || mail.domain,
    smtpHost: mail.smtpHost || mail.domain,
  };
}
