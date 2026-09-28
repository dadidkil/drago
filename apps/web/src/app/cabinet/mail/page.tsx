import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { db } from "@drago/database";
import { getSetting } from "@drago/core";
import { MAILBOX_STATUS_LABELS } from "@drago/shared";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Почта @dragotop.ru" };

/** Почта открывается прямо в кабинете: активный ящик — сразу во «Входящие», без пароля. */
export default async function MailPage() {
  const user = await requireUser();
  const [account, mail] = await Promise.all([db.emailAccount.findUnique({ where: { userId: user.id } }), getSetting("mail")]);
  if (account?.status === "ACTIVE") redirect("/cabinet/mail/inbox");

  return (
    <>
      <PageHeader title={`Почта @${mail.domain}`} description="Корпоративный ящик бойца для переписки от имени отряда." />
      {!account ? (
        <EmptyState title="Корпоративный ящик ещё не создан" icon={<Mail className="size-8" />}>
          Ящик вида имя.фамилия@{mail.domain} создаёт командный состав. Как только он появится, почта откроется здесь — без паролей.
        </EmptyState>
      ) : (
        <Card className="max-w-lg">
          <p className="text-sm text-muted">Ваш адрес</p>
          <p className="mt-1 font-display text-xl font-semibold break-all">{account.address}</p>
          <div className="mt-3">
            <Badge tone={account.status === "ERROR" ? "danger" : "neutral"}>{MAILBOX_STATUS_LABELS[account.status]}</Badge>
          </div>
          <p className="mt-4 text-sm text-muted">Ящик пока не готов. Как только командный состав его включит, придёт уведомление.</p>
        </Card>
      )}
    </>
  );
}
