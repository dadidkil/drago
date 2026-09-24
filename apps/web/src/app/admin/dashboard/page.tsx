import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, CircleCheck } from "lucide-react";
import { db } from "@drago/database";
import { getSetting, isMailerConfigured } from "@drago/core";
import { APPLICATION_STATUS_LABELS, formatDateTime, fullName } from "@drago/shared";
import { Badge, Card, PageHeader, Stat } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Обзор" };

function Check({ ok, label, hint, href }: { ok: boolean; label: string; hint?: string; href?: string }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      {ok ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> : <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />}
      <div className="text-sm">
        <p className="font-medium">
          {href ? (
            <Link href={href} className="hover:text-fire">
              {label}
            </Link>
          ) : (
            label
          )}
        </p>
        {hint && !ok && <p className="text-muted">{hint}</p>}
      </div>
    </li>
  );
}

export default async function AdminDashboard() {
  const user = await requireAdmin();
  const now = new Date();
  const [usersByRole, newApps, appsByStatus, upcomingEvents, openTasks, overdueTasks, staffNo2fa, draftPages, draftProjects, recentAudit, security, pendingDeliveries, failedDeliveries] =
    await Promise.all([
      db.role.findMany({ orderBy: { level: "desc" }, select: { name: true, _count: { select: { users: { where: { status: "ACTIVE" } } } } } }),
      db.joinApplication.count({ where: { status: "NEW" } }),
      db.joinApplication.groupBy({ by: ["status"], _count: true }),
      db.event.count({ where: { startsAt: { gte: now }, status: "SCHEDULED" } }),
      db.task.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] } } }),
      db.task.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] }, dueAt: { lt: now } } }),
      db.user.count({ where: { status: "ACTIVE", role: { level: { gte: 40 } }, totpEnabledAt: null } }),
      db.page.findMany({ where: { isPublished: false }, select: { slug: true, title: true } }),
      db.project.count({ where: { isPublished: false } }),
      user.can("audit.read")
        ? db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { email: true, profile: true } } } })
        : Promise.resolve([]),
      getSetting("security"),
      db.notificationDelivery.count({ where: { status: "PENDING" } }),
      db.notificationDelivery.count({ where: { status: "FAILED", createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } } }),
    ]);
  const totalActive = usersByRole.reduce((s, r) => s + r._count.users, 0);

  return (
    <>
      <PageHeader title="Обзор" eyebrow="Админ-панель" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Активных пользователей" value={totalActive} hint={usersByRole.filter((r) => r._count.users > 0).map((r) => `${r.name}: ${r._count.users}`).join(" · ")} />
        <Stat label="Новых заявок" value={newApps} hint={<Link href="/admin/applications?status=NEW" className="text-fire">Открыть заявки →</Link>} />
        <Stat label="Предстоящих мероприятий" value={upcomingEvents} />
        <Stat label="Открытых задач" value={openTasks} hint={overdueTasks > 0 ? <span className="text-danger">просрочено: {overdueTasks}</span> : "без просрочек"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Состояние системы</h2>
          <ul className="mt-2 divide-y divide-line">
            <Check ok={isMailerConfigured()} label="Исходящая почта (SMTP)" hint="Без SMTP не уходят приглашения и сброс пароля. Настройте SMTP_* в .env." href="/admin/integrations" />
            <Check ok={Boolean(process.env.TELEGRAM_BOT_TOKEN)} label="Telegram-бот" hint="TELEGRAM_BOT_TOKEN не задан" href="/admin/integrations" />
            <Check ok={Boolean(process.env.VK_ACCESS_TOKEN && process.env.VK_CALLBACK_SECRET)} label="VK-бот" hint="VK_ACCESS_TOKEN / VK_CALLBACK_SECRET не заданы" href="/admin/integrations" />
            <Check ok={security.requireStaff2fa} label="2FA обязательна для командного состава" hint="Рекомендуется включить в настройках" href="/admin/settings" />
            <Check ok={staffNo2fa === 0} label="У всего командного состава включена 2FA" hint={`Без 2FA: ${staffNo2fa}`} href="/admin/users" />
            <Check ok={failedDeliveries === 0} label="Доставка уведомлений" hint={`Ошибок за неделю: ${failedDeliveries}; в очереди: ${pendingDeliveries}`} />
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold">Проверьте контент перед запуском</h2>
          <p className="mt-1 text-sm text-muted">Сайт заполнен только проверенными публичными фактами. Черновики ждут данных от командного состава.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {draftPages.map((p) => (
              <li key={p.slug} className="flex items-center justify-between gap-3">
                <span>Страница «{p.title}»</span>
                <Link href={`/admin/pages/page/${p.slug}`} className="font-semibold text-fire">
                  заполнить
                </Link>
              </li>
            ))}
            {draftProjects > 0 && (
              <li className="flex items-center justify-between gap-3">
                <span>Черновики проектов: {draftProjects}</span>
                <Link href="/admin/pages/projects" className="font-semibold text-fire">
                  проверить
                </Link>
              </li>
            )}
            <li className="flex items-center justify-between gap-3">
              <span>Фото командного состава и галерея</span>
              <Link href="/admin/pages/team" className="font-semibold text-fire">
                загрузить
              </Link>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>Контакты и ссылки на соцсети</span>
              <Link href="/admin/pages/contacts" className="font-semibold text-fire">
                проверить
              </Link>
            </li>
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold">Заявки по статусам</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {appsByStatus.map((s) => (
              <li key={s.status}>
                <Link href={`/admin/applications?status=${s.status}`}>
                  <Badge tone={s.status === "NEW" ? "fire" : "neutral"}>
                    {APPLICATION_STATUS_LABELS[s.status]}: {s._count}
                  </Badge>
                </Link>
              </li>
            ))}
            {appsByStatus.length === 0 && <li className="text-sm text-muted">Заявок пока нет</li>}
          </ul>
        </Card>
        {recentAudit.length > 0 && (
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Последние действия</h2>
              <Link href="/admin/audit" className="text-sm font-semibold text-fire">
                Журнал →
              </Link>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {recentAudit.map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-xs">{a.action}</span> · {a.actor?.profile ? fullName(a.actor.profile) : (a.actor?.email ?? "система")}
                  </span>
                  <span className="shrink-0 text-muted">{formatDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
