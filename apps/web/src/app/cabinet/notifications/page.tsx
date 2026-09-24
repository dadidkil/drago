import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { db } from "@drago/database";
import { formatDateTime } from "@drago/shared";
import { InlineAction } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";
import { markAllRead, markRead } from "./actions";

export const metadata: Metadata = { title: "Уведомления" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const hasUnread = items.some((n) => !n.readAt);
  return (
    <>
      <PageHeader
        title="Уведомления"
        description="Уведомления также приходят в Telegram/VK/на почту — настройте каналы в профиле."
        actions={hasUnread ? <InlineAction action={markAllRead} fields={{}} label="Прочитать все" variant="secondary" /> : undefined}
      />
      {items.length === 0 ? (
        <EmptyState title="Уведомлений нет" icon={<Bell className="size-8" />} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {items.map((n) => (
            <li key={n.id} className={`flex items-start gap-4 p-4 sm:p-5 ${n.readAt ? "" : "bg-fire-soft/30"}`}>
              <span className={`mt-2 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-fire"}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{n.url ? <Link href={n.url} className="hover:text-fire">{n.title}</Link> : n.title}</p>
                <p className="mt-0.5 text-sm whitespace-pre-line text-ink-2">{n.body}</p>
                <p className="mt-1 text-xs text-muted">{formatDateTime(n.createdAt)}</p>
              </div>
              {!n.readAt && <InlineAction action={markRead} fields={{ id: n.id }} label="Прочитано" />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
