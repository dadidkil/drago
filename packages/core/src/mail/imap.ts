/**
 * IMAP-доступ к корпоративному ящику: встроенная почта в кабинете.
 *
 * Читаем и отправляем ОТ ИМЕНИ самого бойца — его логином и паролем, а не служебной учёткой.
 * Поэтому пароль сюда приходит на время запроса и нигде на сервере не сохраняется:
 * кабинет держит его в зашифрованной куке (см. apps/web/src/app/cabinet/mail/inbox).
 *
 * Соединение живёт ровно один вызов: на маленькой машине держать пул IMAP-сессий дороже,
 * чем каждый раз открывать её заново — писем мало, а памяти нет.
 */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";

export interface MailboxCreds {
  address: string;
  password: string;
  imapHost: string;
  smtpHost: string;
}

export interface MessageHeader {
  uid: number;
  from: string;
  fromAddress: string;
  subject: string;
  date: string;
  seen: boolean;
  hasAttachments: boolean;
}

export interface MessageBody extends MessageHeader {
  to: string;
  text: string;
  /** Уже готовый HTML письма. Показывать только в песочнице (iframe sandbox + CSP). */
  html: string | null;
  attachments: { filename: string; size: number }[];
}

const IMAP_PORT = 993;
const SMTP_PORT = 465;

async function withImap<T>(creds: MailboxCreds, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const client = new ImapFlow({
    host: creds.imapHost,
    port: IMAP_PORT,
    secure: true,
    auth: { user: creds.address, pass: creds.password },
    logger: false,
    // Сертификат у почтового сервера — Let's Encrypt на имя домена, проверку не отключаем.
    tls: { servername: creds.imapHost },
    socketTimeout: 20_000,
    greetingTimeout: 10_000,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

/** Человекочитаемое «Имя <адрес>» из структуры адреса IMAP. */
function addr(value: { name?: string; address?: string }[] | undefined): { label: string; email: string } {
  const first = value?.[0];
  if (!first) return { label: "—", email: "" };
  const email = first.address ?? "";
  return { label: first.name?.trim() ? first.name.trim() : email, email };
}

/** Последние письма папки «Входящие», новые сверху. */
export async function listInbox(creds: MailboxCreds, limit = 30): Promise<MessageHeader[]> {
  return withImap(creds, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const box = client.mailbox;
      const total = typeof box === "object" ? box.exists : 0;
      if (!total) return [];
      const from = Math.max(1, total - limit + 1);
      const out: MessageHeader[] = [];
      for await (const msg of client.fetch(`${from}:*`, { uid: true, envelope: true, flags: true, bodyStructure: true })) {
        const sender = addr(msg.envelope?.from);
        out.push({
          uid: msg.uid,
          from: sender.label,
          fromAddress: sender.email,
          subject: msg.envelope?.subject?.trim() || "(без темы)",
          date: (msg.envelope?.date ?? new Date()).toISOString(),
          seen: msg.flags?.has("\\Seen") ?? false,
          hasAttachments: JSON.stringify(msg.bodyStructure ?? {}).includes('"attachment"'),
        });
      }
      return out.reverse();
    } finally {
      lock.release();
    }
  });
}

/** Одно письмо целиком. Заодно помечает его прочитанным — как это делает любой почтовый клиент. */
export async function readMessage(creds: MailboxCreds, uid: number): Promise<MessageBody | null> {
  return withImap(creds, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const msg = await client.fetchOne(String(uid), { uid: true, source: true, envelope: true, flags: true }, { uid: true });
      if (!msg || !msg.source) return null;
      const parsed = await simpleParser(msg.source);
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }).catch(() => {});
      const sender = addr(msg.envelope?.from);
      return {
        uid,
        from: sender.label,
        fromAddress: sender.email,
        to: Array.isArray(parsed.to) ? parsed.to.map((t) => t.text).join(", ") : (parsed.to?.text ?? creds.address),
        subject: msg.envelope?.subject?.trim() || "(без темы)",
        date: (msg.envelope?.date ?? new Date()).toISOString(),
        seen: true,
        hasAttachments: parsed.attachments.length > 0,
        text: parsed.text?.trim() ?? "",
        html: typeof parsed.html === "string" ? parsed.html : null,
        attachments: parsed.attachments.map((a) => ({ filename: a.filename ?? "файл", size: a.size })),
      };
    } finally {
      lock.release();
    }
  });
}

/** Удаление письма: переносим в корзину, а если её нет — помечаем удалённым. */
export async function trashMessage(creds: MailboxCreds, uid: number): Promise<void> {
  await withImap(creds, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const boxes = await client.list();
      const trash = boxes.find((b) => b.specialUse === "\\Trash")?.path ?? boxes.find((b) => /trash|корзина/i.test(b.name))?.path;
      if (trash) await client.messageMove(String(uid), trash, { uid: true });
      else await client.messageFlagsAdd(String(uid), ["\\Deleted"], { uid: true });
    } finally {
      lock.release();
    }
  });
}

/** Отправка от имени владельца ящика; копия уходит в «Отправленные», если такая папка есть. */
export async function sendAs(creds: MailboxCreds, msg: { to: string; subject: string; text: string; inReplyTo?: string }): Promise<void> {
  const letter = {
    from: creds.address,
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    inReplyTo: msg.inReplyTo,
    references: msg.inReplyTo,
  };
  await nodemailer
    .createTransport({ host: creds.smtpHost, port: SMTP_PORT, secure: true, auth: { user: creds.address, pass: creds.password } })
    .sendMail(letter);

  // Копию в «Отправленные» кладём сами: SMTP об этой папке ничего не знает.
  // Письмо уже ушло, поэтому любая ошибка здесь — не повод пугать отправителя.
  try {
    const built = await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail(letter);
    const raw = built.message as Buffer;
    await withImap(creds, async (client) => {
      const boxes = await client.list();
      const sent = boxes.find((b) => b.specialUse === "\\Sent")?.path ?? boxes.find((b) => /sent|отправленны/i.test(b.name))?.path;
      if (sent) await client.append(sent, raw, ["\\Seen"]);
    });
  } catch {
    /* нет папки, нет прав, отвалился IMAP — письмо это не отменяет */
  }
}

/** Проверка пары «адрес + пароль» перед тем, как класть её в куку кабинета. */
export async function checkCredentials(creds: MailboxCreds): Promise<boolean> {
  try {
    await withImap(creds, async () => true);
    return true;
  } catch {
    return false;
  }
}
