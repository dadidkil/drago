import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Send, ShieldAlert } from "lucide-react";
import { db } from "@drago/database";
import { announcementsForLevel, documentsForLevel, openTasksForUser, upcomingEventsForUser } from "@drago/core";
import { moscowParts } from "@drago/shared";
import { AnnouncementCard, DocumentRow, DueLabel, EventRow, TaskStatusBadge } from "@/components/cabinet/items";
import { Card, EmptyState } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Главная" };

function greeting(): string {
  const h = moscowParts(new Date()).hour;
  if (h < 6) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

function Block({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-fire">
          Все <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {children}
    </section>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser();
  const { welcome } = await searchParams;
  const [events, announcements, tasks, documents, telegram] = await Promise.all([
    upcomingEventsForUser(user, 4),
    announcementsForLevel(user.level, 3),
    openTasksForUser(user.id, 5),
    documentsForLevel(user.level, 4),
    db.telegramAccount.findUnique({ where: { userId: user.id }, select: { id: true } }),
  ]);

  return (
    <div className="space-y-8">
      <div className="bg-scales relative overflow-hidden rounded-2xl bg-ink p-6 text-paper sm:p-8">
        <div aria-hidden className="absolute -top-20 -right-10 size-64 rounded-full bg-fire-bright/25 blur-3xl" />
        <p className="relative text-sm text-muted-dark">{user.role.name}{user.profile?.position ? ` · ${user.profile.position}` : ""}</p>
        <h1 className="relative mt-1 text-2xl font-semibold sm:text-3xl">
          {greeting()}, {user.profile?.firstName ?? "боец"}!
        </h1>
        {welcome && <p className="relative mt-2 text-paper/80">Добро пожаловать в личный кабинет ТОП «Драго» 🔥</p>}
      </div>

      {(!telegram || (user.level >= 40 && !user.has2fa)) && (
        <div className="grid gap-3 md:grid-cols-2">
          {!telegram && (
            <Card className="flex items-start gap-4">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e3f0fb] text-water">
                <Send className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold">Подключите Telegram</p>
                <p className="mt-1 text-sm text-muted">Уведомления о задачах, мероприятиях и объявлениях — сразу в мессенджер.</p>
                <Link href="/cabinet/security#messengers" className="mt-2 inline-block text-sm font-semibold text-fire">
                  Подключить →
                </Link>
              </div>
            </Card>
          )}
          {user.level >= 40 && !user.has2fa && (
            <Card className="flex items-start gap-4 border-warning/40">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#fdf3e0] text-warning">
                <ShieldAlert className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold">Включите двухфакторную защиту</p>
                <p className="mt-1 text-sm text-muted">Обязательно для командного состава: у вас есть доступ к данным бойцов.</p>
                <Link href="/cabinet/security#twofa" className="mt-2 inline-block text-sm font-semibold text-fire">
                  Настроить →
                </Link>
              </div>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <Block title="Ближайшие мероприятия" href="/cabinet/events">
          {events.length === 0 ? (
            <EmptyState title="Ближайших мероприятий нет" />
          ) : (
            <div className="space-y-3">
              {events.map((e) => (
                <EventRow key={e.id} e={e} myStatus={e.participants[0]?.status} href={`/cabinet/events/${e.id}`} />
              ))}
            </div>
          )}
        </Block>

        <Block title="Мои задачи" href="/cabinet/tasks">
          {tasks.length === 0 ? (
            <EmptyState title="Открытых задач нет">Отдыхай, боец 🙂</EmptyState>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
              {tasks.map((t) => (
                <li key={t.id}>
                  <Link href={`/cabinet/tasks/${t.id}`} className="flex items-start justify-between gap-3 p-4 hover:bg-paper">
                    <div className="min-w-0">
                      <p className="font-semibold">{t.title}</p>
                      <p className="mt-0.5 text-sm">
                        <DueLabel dueAt={t.dueAt} />
                      </p>
                    </div>
                    <TaskStatusBadge status={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title="Объявления" href="/cabinet/announcements">
          {announcements.length === 0 ? (
            <EmptyState title="Объявлений пока нет" />
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <AnnouncementCard key={a.id} a={a} />
              ))}
            </div>
          )}
        </Block>

        <Block title="Последние документы" href="/cabinet/documents">
          {documents.length === 0 ? (
            <EmptyState title="Документов пока нет" />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
              {documents.map((d) => (
                <DocumentRow key={d.id} d={d} />
              ))}
            </ul>
          )}
        </Block>
      </div>
    </div>
  );
}
