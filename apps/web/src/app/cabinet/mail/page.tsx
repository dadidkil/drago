import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { db } from "@drago/database";
import { getSetting } from "@drago/core";
import { MAILBOX_STATUS_LABELS, formatDateTime } from "@drago/shared";
import { buttonClass } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";
import { RevealPassword } from "./reveal";

export const metadata: Metadata = { title: "Почта @dragotop.ru" };

export default async function MailPage() {
  const user = await requireUser();
  const [account, mail] = await Promise.all([db.emailAccount.findUnique({ where: { userId: user.id } }), getSetting("mail")]);
  const hasPending = Boolean(account?.pendingSecretEnc && account.pendingSecretExpiresAt && account.pendingSecretExpiresAt > new Date());

  return (
    <>
      <PageHeader title={`Почта @${mail.domain}`} description="Корпоративный ящик бойца для переписки от имени отряда." />
      {!account ? (
        <EmptyState title="Корпоративный ящик ещё не создан" icon={<Mail className="size-8" />}>
          Ящик вида имя.фамилия@{mail.domain} создаёт командный состав. Если он нужен — напишите командиру.
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <p className="text-sm text-muted">Ваш адрес</p>
            <p className="mt-1 font-display text-xl font-semibold break-all">{account.address}</p>
            <div className="mt-3">
              <Badge tone={account.status === "ACTIVE" ? "success" : account.status === "ERROR" ? "danger" : "neutral"}>
                {MAILBOX_STATUS_LABELS[account.status]}
              </Badge>
            </div>
            {mail.webmailUrl && account.status === "ACTIVE" && (
              <a href={mail.webmailUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "md", "mt-5")}>
                Открыть веб-почту
              </a>
            )}
            {hasPending && (
              <div className="mt-6 border-t border-line pt-5">
                <p className="mb-1 font-semibold">Временный пароль готов</p>
                <p className="mb-4 text-sm text-muted">
                  Действует до {formatDateTime(account.pendingSecretExpiresAt!)}. После первого входа смените его в настройках веб-почты.
                </p>
                <RevealPassword />
              </div>
            )}
            {account.lastPasswordResetAt && !hasPending && (
              <p className="mt-5 text-xs text-muted">Пароль последний раз выпускался {formatDateTime(account.lastPasswordResetAt)}.</p>
            )}
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Настройки для почтовых программ</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Логин</dt>
              <dd className="font-mono break-all">{account.address}</dd>
              <dt className="text-muted">IMAP</dt>
              <dd className="font-mono">{mail.imapHost}:993 (SSL/TLS)</dd>
              <dt className="text-muted">SMTP</dt>
              <dd className="font-mono">{mail.smtpHost}:465 (SSL/TLS) или :587 (STARTTLS)</dd>
            </dl>
            <p className="mt-4 text-sm text-muted">
              Используйте корпоративную почту только для дел отряда. Не пересылайте на неё и с неё документы с персональными данными без необходимости.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
