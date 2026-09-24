import type { Metadata } from "next";
import Link from "next/link";
import { db, type ApplicationStatus } from "@drago/database";
import { APPLICATION_SOURCE_LABELS, APPLICATION_STATUS_LABELS, formatDateTime } from "@drago/shared";
import { Pagination, Table, Td } from "@/components/admin/table";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { pageParam } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Заявки" };
const PAGE = 30;

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireAdmin("applications.read");
  const sp = await searchParams;
  const status = sp.status && sp.status in APPLICATION_STATUS_LABELS ? (sp.status as ApplicationStatus) : undefined;
  const page = pageParam(sp.page);
  const where = status ? { status } : {};
  const [items, total, counts] = await Promise.all([
    db.joinApplication.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.joinApplication.count({ where }),
    db.joinApplication.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <>
      <PageHeader title="Заявки на вступление" description="Персональные данные кандидатов — только для командного состава. Отклонённые и старые заявки удаляются автоматически по сроку хранения." />
      <nav aria-label="Статусы" className="mb-5 flex flex-wrap gap-2">
        <Link href="/admin/applications" className={`rounded-full px-3 py-1.5 text-sm font-medium ${!status ? "bg-ink text-paper" : "bg-white hover:bg-paper-2"}`}>
          Все
        </Link>
        {Object.entries(APPLICATION_STATUS_LABELS).map(([k, v]) => (
          <Link key={k} href={`/admin/applications?status=${k}`} className={`rounded-full px-3 py-1.5 text-sm font-medium ${status === k ? "bg-ink text-paper" : "bg-white hover:bg-paper-2"}`}>
            {v} <span className="opacity-60">{count(k)}</span>
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <EmptyState title="Заявок нет" />
      ) : (
        <Table headers={["Кандидат", "Возраст", "Источник", "Статус", "Дата"]}>
          {items.map((a) => (
            <tr key={a.id} className="hover:bg-paper/60">
              <Td>
                <Link href={`/admin/applications/${a.id}`} className="font-semibold hover:text-fire">
                  {a.fullName}
                </Link>
                {a.school && <p className="text-xs text-muted">{a.school}</p>}
              </Td>
              <Td>{a.age}</Td>
              <Td>{APPLICATION_SOURCE_LABELS[a.source]}</Td>
              <Td>
                <Badge tone={a.status === "NEW" ? "fire" : a.status === "ACCEPTED" ? "success" : a.status === "DECLINED" ? "neutral" : "water"}>
                  {APPLICATION_STATUS_LABELS[a.status]}
                </Badge>
              </Td>
              <Td className="text-muted">{formatDateTime(a.createdAt)}</Td>
            </tr>
          ))}
        </Table>
      )}
      <Pagination page={page} pages={Math.ceil(total / PAGE)} makeHref={(p) => `/admin/applications?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) })}`} />
    </>
  );
}
