import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@drago/database";
import { getMailProvisioner, mailDomain } from "@drago/core";
import { MAILBOX_STATUS_LABELS, formatDateTime, fullName, suggestMailbox } from "@drago/shared";
import { Table, Td } from "@/components/admin/table";
import { InlineAction } from "@/components/ui/form";
import { Badge, Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { deleteMailbox, resetMailboxPassword, setMailboxStatus } from "./actions";
import { CreateMailboxForm } from "./forms";

export const metadata: Metadata = { title: "Почта" };

export default async function AdminMail({ searchParams }: { searchParams: Promise<{ userId?: string }> }) {
  await requireAdmin("mail.manage");
  const { userId } = await searchParams;
  const provisioner = getMailProvisioner();
  const [health, accounts, candidates] = await Promise.all([
    provisioner.healthcheck(),
    db.emailAccount.findMany({ orderBy: { address: "asc" }, include: { user: { select: { id: true, profile: true } } } }),
    db.user.findMany({
      where: { status: "ACTIVE", emailAccount: null },
      orderBy: { profile: { lastName: "asc" } },
      select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } },
    }),
  ]);
  const domain = mailDomain();

  return (
    <>
      <PageHeader title={`Почта @${domain}`} description="Корпоративные ящики бойцов. Пароли не хранятся и не показываются администраторам." />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <h2 className="mb-4 font-semibold">Новый ящик</h2>
          <CreateMailboxForm
            domain={domain}
            preselect={userId}
            users={candidates.map((u) => ({ id: u.id, name: u.profile ? fullName(u.profile) : u.email, suggestion: u.profile ? suggestMailbox(u.profile.firstName, u.profile.lastName) : "" }))}
          />
        </Card>
        <Card>
          <h2 className="font-semibold">Провайдер</h2>
          <p className="mt-2 text-sm">
            Режим: <span className="font-semibold">{provisioner.kind === "STALWART" ? "Stalwart (автоматически)" : "Ручной"}</span>
          </p>
          <p className={`mt-1 text-sm ${health.ok ? "text-success" : "text-danger"}`}>{health.message}</p>
          <p className="mt-3 text-xs text-muted">
            Перед выдачей ящиков убедитесь, что DNS (MX, SPF, DKIM, DMARC, PTR) настроены и доставка проверена — см. docs/mail.md.
          </p>
        </Card>
      </div>
      <h2 className="mt-8 mb-3 text-lg font-semibold">Ящики ({accounts.length})</h2>
      <Table headers={["Адрес", "Владелец", "Статус", "Пароль", "Действия"]}>
        {accounts.map((a) => (
          <tr key={a.id}>
            <Td className="font-mono">{a.address}</Td>
            <Td>
              <Link href={`/admin/users/${a.user.id}`} className="hover:text-fire">
                {a.user.profile ? fullName(a.user.profile) : "—"}
              </Link>
            </Td>
            <Td>
              <Badge tone={a.status === "ACTIVE" ? "success" : a.status === "ERROR" ? "danger" : "neutral"}>{MAILBOX_STATUS_LABELS[a.status]}</Badge>
              {a.lastError && <p className="mt-1 max-w-xs text-xs text-danger">{a.lastError}</p>}
            </Td>
            <Td className="text-xs text-muted">
              {a.pendingSecretEnc ? "ожидает показа владельцу" : a.lastPasswordResetAt ? `выпущен ${formatDateTime(a.lastPasswordResetAt)}` : "—"}
            </Td>
            <Td>
              <div className="flex flex-wrap gap-1">
                {provisioner.automated && (
                  <InlineAction action={resetMailboxPassword} fields={{ id: a.id }} label="Новый временный пароль" confirm="Выпустить новый временный пароль? Старый перестанет работать." />
                )}
                {a.status === "ACTIVE" ? (
                  <InlineAction action={setMailboxStatus} fields={{ id: a.id, status: "DISABLED" }} label="Отключить" confirm="Отключить ящик?" />
                ) : (
                  !provisioner.automated && <InlineAction action={setMailboxStatus} fields={{ id: a.id, status: "ACTIVE" }} label="Отметить активным" />
                )}
                <InlineAction action={deleteMailbox} fields={{ id: a.id }} label="Удалить" confirm="Удалить ящик вместе с письмами?" />
              </div>
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
