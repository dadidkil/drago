import { db } from "@drago/database";
import { decryptSecret, encryptSecret, generatePassword } from "../crypto";
import { createLogger } from "../logger";
import { getSetting } from "../settings";
import { checkCredentials, type MailboxCreds } from "./imap";
import { getMailProvisioner } from "./provisioner";

/**
 * Автоматический вход в корпоративную почту.
 *
 * Пароль ящика — служебный: его генерирует система, хранит зашифрованным (APP_ENCRYPTION_KEY) и никому
 * не показывает. По нему кабинет открывает «Входящие» без ввода пароля, а воркер проверяет новые письма.
 * Если пароля ещё нет (ящик создан до этой схемы) или сервер его не принимает — система сама
 * перевыпускает пароль через API почтового сервера (ISPmanager/Stalwart). В ручном режиме это невозможно.
 */

const log = createLogger("mail-access");

export type MailboxAccess =
  | { ok: true; creds: MailboxCreds; address: string }
  | { ok: false; reason: "no_mailbox" | "not_active" | "manual" | "error"; message: string };

async function hosts() {
  const mail = await getSetting("mail");
  return { imapHost: mail.imapHost || mail.domain, smtpHost: mail.smtpHost || mail.domain };
}

/** Выпустить новый служебный пароль ящика и сохранить его зашифрованным. */
export async function rotateMailboxPassword(accountId: string): Promise<string> {
  const account = await db.emailAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Ящик не найден");
  const provisioner = getMailProvisioner();
  if (!provisioner.automated) throw new Error("Ручной режим почты: пароль меняется у провайдера");
  const password = generatePassword();
  await provisioner.setPassword(account.address, password);
  await db.emailAccount.update({
    where: { id: account.id },
    data: { passwordEnc: encryptSecret(password), pendingSecretEnc: null, pendingSecretExpiresAt: null, lastPasswordResetAt: new Date(), lastError: null },
  });
  return password;
}

/** Доступ к ящику пользователя без ввода пароля. `verify` — проверить у сервера и при отказе перевыпустить. */
export async function mailboxAccess(userId: string, opts: { verify?: boolean } = {}): Promise<MailboxAccess> {
  const account = await db.emailAccount.findUnique({ where: { userId } });
  if (!account) return { ok: false, reason: "no_mailbox", message: "Корпоративный ящик ещё не создан" };
  if (account.status !== "ACTIVE") return { ok: false, reason: "not_active", message: "Ящик ещё не готов или отключён" };
  const h = await hosts();

  let password: string | null = null;
  if (account.passwordEnc) {
    try {
      password = decryptSecret(account.passwordEnc);
    } catch {
      password = null;
    }
  }

  const provisioner = getMailProvisioner();
  if (!password) {
    if (!provisioner.automated) return { ok: false, reason: "manual", message: "Почта в ручном режиме — вход из кабинета недоступен" };
    try {
      password = await rotateMailboxPassword(account.id);
      log.info("mailbox password issued for auto-login", { accountId: account.id });
    } catch (err) {
      return { ok: false, reason: "error", message: `Почтовый сервер не ответил: ${(err as Error).message.slice(0, 160)}` };
    }
  }

  let creds: MailboxCreds = { address: account.address, password, ...h };
  if (opts.verify && !(await checkCredentials(creds))) {
    // Пароль сменили в обход системы — перевыпускаем и пробуем ещё раз.
    if (!provisioner.automated) return { ok: false, reason: "manual", message: "Почтовый сервер не принял пароль" };
    try {
      creds = { ...creds, password: await rotateMailboxPassword(account.id) };
    } catch (err) {
      return { ok: false, reason: "error", message: `Почтовый сервер не ответил: ${(err as Error).message.slice(0, 160)}` };
    }
    if (!(await checkCredentials(creds))) return { ok: false, reason: "error", message: "Почтовый сервер не принимает вход. Напишите командиру." };
  }
  return { ok: true, creds, address: account.address };
}
