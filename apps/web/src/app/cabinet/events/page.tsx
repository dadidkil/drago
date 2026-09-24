import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { db } from "@drago/database";
import { EventRow } from "@/components/cabinet/items";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Мероприятия" };

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requireUser();
  const past = (await searchParams).show === "past";
  const now = new Date();
  const events = await db.event.findMany({
    where: { minRoleLevel: { lte: user.level }, ...(past ? { startsAt: { lt: now } } : { OR: [{ startsAt: { gte: now } }, { endsAt: { gte: now } }] }) },
    orderBy: { startsAt: past ? "desc" : "asc" },
    take: 100,
    include: { participants: { where: { userId: user.id }, select: { status: true } } },
  });
  return (
    <>
      <PageHeader
        title="Мероприятия"
        actions={
          <>
            <ButtonLink href="/cabinet/events" variant={past ? "ghost" : "secondary"} size="sm">
              Предстоящие
            </ButtonLink>
            <ButtonLink href="/cabinet/events?show=past" variant={past ? "secondary" : "ghost"} size="sm">
              Прошедшие
            </ButtonLink>
            <ButtonLink href="/cabinet/calendar" variant="ghost" size="sm">
              Календарь
            </ButtonLink>
          </>
        }
      />
      {events.length === 0 ? (
        <EmptyState title={past ? "Прошедших мероприятий нет" : "Предстоящих мероприятий нет"} icon={<CalendarDays className="size-8" />} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {events.map((e) => (
            <EventRow key={e.id} e={e} myStatus={e.participants[0]?.status} href={`/cabinet/events/${e.id}`} />
          ))}
        </div>
      )}
    </>
  );
}
