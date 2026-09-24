import nodemailer, { type Transporter } from "nodemailer";
import { escapeHtml } from "@drago/shared";
import { appUrl } from "./env";
import { createLogger } from "./logger";

const log = createLogger("mailer");

let transporter: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    transporter = null;
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    requireTLS: process.env.SMTP_SECURE !== "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export function isMailerConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendMail(msg: MailMessage): Promise<void> {
  const t = getTransport();
  if (!t) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP не настроен");
    // В разработке письма пишутся в лог, чтобы можно было пройти сценарии приглашения/сброса.
    log.info("DEV MAIL (SMTP не настроен)", { to: msg.to, subject: msg.subject, text: msg.text });
    return;
  }
  await t.sendMail({ from: process.env.MAIL_FROM ?? "noreply@dragotop.ru", ...msg });
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="ru"><body style="margin:0;background:#f4f1ec;font-family:Arial,Helvetica,sans-serif;color:#15131a">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden" cellpadding="0" cellspacing="0">
<tr><td style="background:#15131a;color:#fff;padding:20px 28px;font-size:18px;font-weight:bold;letter-spacing:.5px">ТОП «Драго»</td></tr>
<tr><td style="padding:28px"><h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:16px 28px;color:#6b6772;font-size:12px;border-top:1px solid #eee">Письмо отправлено автоматически. Если вы не ожидали его — просто проигнорируйте.</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="background:#e8431a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;display:inline-block">${escapeHtml(label)}</a></p>
<p style="font-size:12px;color:#6b6772;word-break:break-all">Если кнопка не работает, скопируйте ссылку: ${escapeHtml(href)}</p>`;
}

export function inviteMail(to: string, link: string, name: string): MailMessage {
  const subject = "Приглашение в личный кабинет ТОП «Драго»";
  return {
    to,
    subject,
    text: `Привет, ${name}!\n\nДля тебя создан аккаунт в личном кабинете ТОП «Драго». Задай пароль по ссылке (действует 72 часа):\n${link}`,
    html: layout(subject, `<p>Привет, ${escapeHtml(name)}!</p><p>Для тебя создан аккаунт в личном кабинете ТОП «Драго». Задай пароль — ссылка действует 72 часа.</p>${button(link, "Задать пароль")}`),
  };
}

export function passwordResetMail(to: string, link: string): MailMessage {
  const subject = "Восстановление пароля — ТОП «Драго»";
  return {
    to,
    subject,
    text: `Кто-то (возможно, вы) запросил сброс пароля. Ссылка действует 1 час:\n${link}\n\nЕсли это были не вы — ничего не делайте.`,
    html: layout(subject, `<p>Кто-то (возможно, вы) запросил сброс пароля. Ссылка действует 1 час.</p>${button(link, "Сбросить пароль")}<p>Если это были не вы — ничего не делайте, пароль останется прежним.</p>`),
  };
}

export function verifyEmailMail(to: string, link: string): MailMessage {
  const subject = "Подтверждение email — ТОП «Драго»";
  return {
    to,
    subject,
    text: `Подтвердите адрес электронной почты (ссылка действует 24 часа):\n${link}`,
    html: layout(subject, `<p>Подтвердите адрес электронной почты — ссылка действует 24 часа.</p>${button(link, "Подтвердить email")}`),
  };
}

export function notificationMail(to: string, title: string, body: string, url?: string | null): MailMessage {
  const link = url ? appUrl(url) : appUrl("/cabinet");
  return {
    to,
    subject: `${title} — ТОП «Драго»`,
    text: `${body}\n\n${link}\n\nНастроить уведомления: ${appUrl("/cabinet/profile#notifications")}`,
    html: layout(
      title,
      `<p style="white-space:pre-line">${escapeHtml(body)}</p>${button(link, "Открыть в кабинете")}<p style="font-size:12px;color:#6b6772">Настроить уведомления можно в <a href="${escapeHtml(appUrl("/cabinet/profile#notifications"))}">профиле</a>.</p>`,
    ),
  };
}
