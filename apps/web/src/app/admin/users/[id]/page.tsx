import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@drago/database";
import { USER_STATUS_LABELS, canManageLevel, formatDateTime, fullName } from "@drago/shared";
import { Badge, Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { DeleteUserForm, EditUserForm, UserSecurityActions } from "../user-forms";

export const metadata: Metadata = { title: "Пользователь" };

export default async function UserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; nomail?: string }> }) {
  const actor = await requireAdmin("users.read");
  const { id } = await params;
  const sp = await searchParams;
  const user = await db.user.findUnique({
    where: { id },
    include: {
      role: true,
      profile: true,
      telegramAccount: { select: { username: true, linkedAt: true } },
      vkAccount: { select: { linkedAt: true } },
      emailAccount: { select: { address: true, status: true } },
      _count: { select: { sessions: true, taskAssignments: true } },
    },
  });
  if (!user) notFound();
  const manageable = actor.can("users.manage") && user.id !== actor.id && canManageLevel(actor.level, user.role.level);
  const roles = (await db.role.findMany({ orderBy: { level: "desc" } })).filter(
    (r) => r.key === user.role.key || (canManageLevel(actor.level, r.level) && (actor.can("users.roles") || ["FIGHTER", "CANDIDATE"].includes(r.key))),
  );
  const name = user.profile ? fullName(user.profile) : user.email;

  return (
    <>
      <Link href="/admin/users" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-fire">
        <ArrowLeft className="size-4" aria-hidden /> Пользователи
      </Link>
      <PageHeader title={name} description={<span className="flex flex-wrap items-center gap-2">{user.role.name} <Badge>{USER_STATUS_LABELS[user.status]}</Badge></span>} />
      {sp.created && (
        <p className="mb-4 rounded-xl bg-[#e7f5ec] px-4 py-3 text-sm text-success">
          Пользователь создан.{" "}
          {sp.nomail ? "SMTP не настроен — письмо не отправлено: используйте «Показать ссылку-приглашение»." : "Приглашение отправлено на email."}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          {manageable ? (
            <EditUserForm
              user={{ id: user.id, email: user.email, status: user.status, roleKey: user.role.key, profile: user.profile }}
              roles={roles.map((r) => ({ key: r.key, name: r.name }))}
            />
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-muted">{user.id === actor.id ? "Свой профиль редактируйте в кабинете." : "Недостаточно прав для редактирования этого пользователя."}</p>
              <p>Email: {user.email}</p>
              {user.profile?.phone && <p>Телефон: {user.profile.phone}</p>}
            </div>
          )}
        </Card>
        <aside className="space-y-4 self-start">
          <Card>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Создан</dt>
                <dd>{formatDateTime(user.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Последний вход</dt>
                <dd>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Email подтверждён</dt>
                <dd>{user.emailVerifiedAt ? "да" : "нет"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">2FA</dt>
                <dd>{user.totpEnabledAt ? "включена" : "выключена"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Активных сессий</dt>
                <dd>{user._count.sessions}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Telegram</dt>
                <dd>{user.telegramAccount ? `@${user.telegramAccount.username ?? "привязан"}` : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">ВКонтакте</dt>
                <dd>{user.vkAccount ? "привязан" : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Почта</dt>
                <dd className="truncate">{user.emailAccount?.address ?? "—"}</dd>
              </div>
            </dl>
            {actor.can("mail.manage") && !user.emailAccount && user.status === "ACTIVE" && (
              <Link href={`/admin/mail?userId=${user.id}`} className="mt-4 inline-block text-sm font-semibold text-fire">
                Создать ящик @dragotop.ru →
              </Link>
            )}
          </Card>
          {manageable && (
            <Card>
              <h2 className="mb-3 font-semibold">Доступ</h2>
              <UserSecurityActions userId={user.id} status={user.status} has2fa={Boolean(user.totpEnabledAt)} />
            </Card>
          )}
          {manageable && actor.can("users.delete") && (
            <Card className="border-danger/30">
              <h2 className="mb-3 font-semibold text-danger">Удаление</h2>
              <DeleteUserForm userId={user.id} email={user.email} />
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
