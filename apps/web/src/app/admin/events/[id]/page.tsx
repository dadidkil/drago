import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@drago/database";
import { PARTICIPATION_LABELS, formatDateTime, fullName } from "@drago/shared";
import { Table, Td } from "@/components/admin/table";
import { InlineAction } from "@/components/ui/form";
import { Badge, Card, PageHeader } from "@/components/ui/misc";
import { activeUserOptions } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth/current-user";
import { deleteEvent, markAttendance, setEventStatus } from "../actions";
import { EventForm } from "../form";

export const metadata: Metadata = { title: "Мероприятие" };

export default async function EditEvent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin("events.manage");
  const { id } = await params;
  const { saved } = await searchParams;
  const event = await db.event.findUnique({
    where: { id },
    include: { participants: { include: { user: { select: { profile: true, email: true } } }, orderBy: { status: "asc" } } },
  });
  if (!event) notFound();
  const users = await activeUserOptions();
  const counts = Object.fromEntries(Object.keys(PARTICIPATION_LABELS).map((k) => [k, event.participants.filter((p) => p.status === k).length]));

  return (
    <>
      <Link href="/admin/events" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-fire">
        <ArrowLeft className="size-4" aria-hidden /> Мероприятия
      </Link>
      <PageHeader
        title={event.title}
        description={event.status === "CANCELLED" ? <Badge tone="danger">Отменено</Badge> : formatDateTime(event.startsAt)}
        actions={
          <>
            <InlineAction
              action={setEventStatus}
              fields={{ id: event.id, status: event.status === "CANCELLED" ? "SCHEDULED" : "CANCELLED" }}
              label={event.status === "CANCELLED" ? "Восстановить" : "Отменить мероприятие"}
              variant="secondary"
              confirm={event.status === "CANCELLED" ? undefined : "Отменить мероприятие и уведомить участников?"}
            />
            <InlineAction action={deleteEvent} fields={{ id: event.id }} label="Удалить" variant="danger" confirm="Удалить мероприятие безвозвратно?" />
          </>
        }
      />
      {saved && <p className="mb-4 rounded-xl bg-[#e7f5ec] px-4 py-3 text-sm text-success">Мероприятие создано, участники уведомлены.</p>}
      <div className="space-y-6">
        <Card>
          <EventForm event={event} users={users} participantIds={event.participants.map((p) => p.userId)} />
        </Card>
        <section>
          <h2 className="mb-3 text-lg font-semibold">Участники</h2>
          <p className="mb-3 flex flex-wrap gap-2 text-sm">
            {Object.entries(PARTICIPATION_LABELS).map(([k, v]) => (
              <Badge key={k}>
                {v}: {counts[k]}
              </Badge>
            ))}
          </p>
          <Table headers={["Участник", "Ответ", "Когда ответил(а)", "Присутствие"]}>
            {event.participants.map((p) => (
              <tr key={p.userId}>
                <Td>{p.user.profile ? fullName(p.user.profile) : p.user.email}</Td>
                <Td>
                  <Badge tone={p.status === "GOING" || p.status === "ATTENDED" ? "success" : p.status === "NOT_GOING" ? "neutral" : "water"}>{PARTICIPATION_LABELS[p.status]}</Badge>
                </Td>
                <Td className="text-muted">{p.respondedAt ? formatDateTime(p.respondedAt) : "—"}</Td>
                <Td>
                  {(p.status === "GOING" || p.status === "ATTENDED") && (
                    <InlineAction
                      action={markAttendance}
                      fields={{ eventId: event.id, userId: p.userId, attended: p.status === "ATTENDED" ? "false" : "true" }}
                      label={p.status === "ATTENDED" ? "Снять отметку" : "Был(а)"}
                    />
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        </section>
      </div>
    </>
  );
}
