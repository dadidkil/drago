import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@drago/database";
import { EVENT_TYPE_LABELS, audienceLabel, formatDateTime } from "@drago/shared";
import { Table, Td } from "@/components/admin/table";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Мероприятия" };

export default async function AdminEvents({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin("events.manage");
  const past = (await searchParams).show === "past";
  const now = new Date();
  const events = await db.event.findMany({
    where: past ? { startsAt: { lt: now } } : { OR: [{ startsAt: { gte: now } }, { endsAt: { gte: now } }] },
    orderBy: { startsAt: past ? "desc" : "asc" },
    take: 200,
    include: { _count: { select: { participants: { where: { status: { in: ["GOING", "ATTENDED"] } } } } } },
  });
  return (
    <>
      <PageHeader
        title="Мероприятия"
        actions={
          <>
            <ButtonLink href="/admin/events" variant={past ? "ghost" : "secondary"} size="sm">
              Предстоящие
            </ButtonLink>
            <ButtonLink href="/admin/events?show=past" variant={past ? "secondary" : "ghost"} size="sm">
              Прошедшие
            </ButtonLink>
            <ButtonLink href="/admin/events/new" size="sm">
              Новое мероприятие
            </ButtonLink>
          </>
        }
      />
      {events.length === 0 ? (
        <EmptyState title="Мероприятий нет" />
      ) : (
        <Table headers={["Мероприятие", "Когда", "Аудитория", "Идут"]}>
          {events.map((e) => (
            <tr key={e.id}>
              <Td>
                <Link href={`/admin/events/${e.id}`} className="font-semibold hover:text-fire">
                  {e.title}
                </Link>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge>{EVENT_TYPE_LABELS[e.type]}</Badge>
                  {e.isPublic && <Badge tone="water">на сайте</Badge>}
                  {e.status === "CANCELLED" && <Badge tone="danger">отменено</Badge>}
                </div>
              </Td>
              <Td>{formatDateTime(e.startsAt)}</Td>
              <Td>{audienceLabel(e.minRoleLevel)}</Td>
              <Td>
                {e._count.participants}
                {e.capacity ? ` / ${e.capacity}` : ""}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
