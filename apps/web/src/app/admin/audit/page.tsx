import type { Metadata } from "next";
import { db, type Prisma } from "@drago/database";
import { formatDateTime, fullName } from "@drago/shared";
import { FilterBar, filterInput, Pagination, Table, Td } from "@/components/admin/table";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { pageParam } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Журнал аудита" };
const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; entity?: string; actor?: string; page?: string }> }) {
  await requireAdmin("audit.read");
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const where: Prisma.AuditLogWhereInput = {
    ...(sp.action ? { action: { startsWith: sp.action.slice(0, 60) } } : {}),
    ...(sp.entity ? { entity: sp.entity.slice(0, 60) } : {}),
    ...(sp.actor ? { actor: { email: { contains: sp.actor.slice(0, 100), mode: "insensitive" } } } : {}),
  };
  const [items, total, entities] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { actor: { select: { email: true, profile: true } } } }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
  ]);
  const qs = (p: number) => `/admin/audit?${new URLSearchParams({ ...(sp.action ? { action: sp.action } : {}), ...(sp.entity ? { entity: sp.entity } : {}), ...(sp.actor ? { actor: sp.actor } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Журнал аудита" description={`Записей: ${total}. Старые записи удаляются по сроку хранения из настроек.`} />
      <FilterBar>
        <input name="action" defaultValue={sp.action} placeholder="Действие, напр. user." aria-label="Действие" className={`${filterInput} sm:w-56`} />
        <select name="entity" defaultValue={sp.entity ?? ""} aria-label="Сущность" className={filterInput}>
          <option value="">Все сущности</option>
          {entities.map((e) => (
            <option key={e.entity} value={e.entity}>
              {e.entity}
            </option>
          ))}
        </select>
        <input name="actor" defaultValue={sp.actor} placeholder="Email актора" aria-label="Актор" className={`${filterInput} sm:w-56`} />
        <button className={buttonClass("secondary", "sm")}>Фильтр</button>
      </FilterBar>
      <Table headers={["Время", "Кто", "Действие", "Объект", "IP", "Детали"]}>
        {items.map((a) => (
          <tr key={a.id}>
            <Td className="whitespace-nowrap text-muted">{formatDateTime(a.createdAt)}</Td>
            <Td>{a.actor ? (a.actor.profile ? fullName(a.actor.profile) : a.actor.email) : <span className="text-muted">система</span>}</Td>
            <Td className="font-mono text-xs">{a.action}</Td>
            <Td className="text-xs">
              {a.entity}
              {a.entityId && <span className="block text-muted">{a.entityId}</span>}
            </Td>
            <Td className="font-mono text-xs text-muted">{a.ipAddress ?? "—"}</Td>
            <Td className="max-w-xs font-mono text-xs break-all text-muted">{a.metadata ? JSON.stringify(a.metadata).slice(0, 200) : ""}</Td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / PAGE)} makeHref={qs} />
    </>
  );
}
