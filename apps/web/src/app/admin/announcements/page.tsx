import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@drago/database";
import { audienceLabel, formatDate } from "@drago/shared";
import { Table, Td } from "@/components/admin/table";
import { ButtonLink } from "@/components/ui/button";
import { InlineAction } from "@/components/ui/form";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { deleteAnnouncement } from "./actions";

export const metadata: Metadata = { title: "Объявления" };

export default async function AdminAnnouncements({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin("announcements.manage");
  const { saved } = await searchParams;
  const items = await db.announcement.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 200, include: { _count: { select: { attachments: true } } } });
  return (
    <>
      <PageHeader title="Объявления" description="Видны в кабинете выбранной аудитории; при публикации рассылаются уведомления." actions={<ButtonLink href="/admin/announcements/new">Новое объявление</ButtonLink>} />
      {saved && <p className="mb-4 rounded-xl bg-[#e7f5ec] px-4 py-3 text-sm text-success">Сохранено.</p>}
      {items.length === 0 ? (
        <EmptyState title="Объявлений пока нет" />
      ) : (
        <Table headers={["Заголовок", "Аудитория", "Дата", "Актуально до", ""]}>
          {items.map((a) => (
            <tr key={a.id}>
              <Td>
                <Link href={`/admin/announcements/${a.id}`} className="font-semibold hover:text-fire">
                  {a.title}
                </Link>
                <div className="mt-1 flex gap-1">
                  {a.pinned && <Badge tone="fire">закреплено</Badge>}
                  {a._count.attachments > 0 && <Badge>вложений: {a._count.attachments}</Badge>}
                </div>
              </Td>
              <Td>{audienceLabel(a.minRoleLevel)}</Td>
              <Td className="text-muted">{formatDate(a.createdAt)}</Td>
              <Td className="text-muted">{a.expiresAt ? formatDate(a.expiresAt) : "—"}</Td>
              <Td>
                <InlineAction action={deleteAnnouncement} fields={{ id: a.id }} label="Удалить" confirm="Удалить объявление?" />
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
