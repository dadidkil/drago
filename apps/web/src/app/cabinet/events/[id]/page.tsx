import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, MapPin, User, Users } from "lucide-react";
import { db } from "@drago/database";
import { EVENT_TYPE_LABELS, PARTICIPATION_LABELS, formatDate, formatTime, formatWeekday, fullName } from "@drago/shared";
import { Badge, Card } from "@/components/ui/misc";
import { Markdown } from "@/components/ui/markdown";
import { requireUser } from "@/lib/auth/current-user";
import { RsvpForm } from "./rsvp-form";

export const metadata: Metadata = { title: "Мероприятие" };

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const event = await db.event.findUnique({
    where: { id },
    include: {
      organizer: { select: { profile: true } },
      participants: {
        where: { status: { in: ["GOING", "MAYBE", "ATTENDED"] } },
        include: { user: { select: { id: true, profile: true } } },
        orderBy: { respondedAt: "asc" },
      },
    },
  });
  if (!event || event.minRoleLevel > user.level) notFound();
  const mine = await db.eventParticipant.findUnique({ where: { eventId_userId: { eventId: event.id, userId: user.id } } });
  const going = event.participants.filter((p) => p.status === "GOING" || p.status === "ATTENDED");
  const isPast = event.startsAt.getTime() < Date.now() - 3600_000;

  return (
    <div className="space-y-6">
      <Link href="/cabinet/events" className="inline-flex items-center gap-1 text-sm font-semibold text-fire">
        <ArrowLeft className="size-4" aria-hidden /> Мероприятия
      </Link>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-[0.12em] text-fire uppercase">{EVENT_TYPE_LABELS[event.type]}</span>
          {event.status === "CANCELLED" && <Badge tone="danger">Отменено</Badge>}
        </div>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{event.title}</h1>
        <ul className="mt-4 grid gap-2 text-ink-2 sm:grid-cols-2">
          <li className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted" aria-hidden /> {formatWeekday(event.startsAt)}, {formatDate(event.startsAt)}
            {event.endsAt && formatDate(event.endsAt) !== formatDate(event.startsAt) ? ` — ${formatDate(event.endsAt)}` : ""}
          </li>
          {!event.allDay && (
            <li className="flex items-center gap-2">
              <Clock className="size-4 text-muted" aria-hidden /> {formatTime(event.startsAt)}
              {event.endsAt ? `–${formatTime(event.endsAt)}` : ""} (МСК)
            </li>
          )}
          {event.location && (
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-muted" aria-hidden /> {event.location}
            </li>
          )}
          {event.organizer?.profile && (
            <li className="flex items-center gap-2">
              <User className="size-4 text-muted" aria-hidden /> Организатор: {fullName(event.organizer.profile)}
            </li>
          )}
          <li className="flex items-center gap-2">
            <Users className="size-4 text-muted" aria-hidden /> Идут: {going.length}
            {event.capacity ? ` из ${event.capacity}` : ""}
          </li>
        </ul>
        {event.description && <Markdown source={event.description} className="mt-5 border-t border-line pt-5" />}
        {event.requiresConfirmation && event.status !== "CANCELLED" && !isPast && (
          <div className="mt-6 border-t border-line pt-5">
            <p className="mb-3 text-sm text-muted">
              Твой ответ: <span className="font-semibold text-ink">{mine ? PARTICIPATION_LABELS[mine.status] : "ещё не ответил(а)"}</span>
            </p>
            <RsvpForm eventId={event.id} current={mine?.status ?? null} />
          </div>
        )}
        {user.can("events.manage") && (
          <Link href={`/admin/events/${event.id}`} className="mt-4 inline-block text-sm font-semibold text-fire">
            Управлять в админ-панели →
          </Link>
        )}
      </Card>
      {going.length > 0 && (
        <section aria-labelledby="participants-title">
          <h2 id="participants-title" className="mb-3 text-lg font-semibold">
            Участники
          </h2>
          <ul className="flex flex-wrap gap-2">
            {going.map((p) => (
              <li key={p.userId} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm">
                {p.user.profile ? fullName(p.user.profile) : "—"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
