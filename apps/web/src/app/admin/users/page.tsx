import type { Metadata } from "next";
import Link from "next/link";
import { db, type Prisma } from "@drago/database";
import { USER_STATUS_LABELS, formatDateTime, fullName } from "@drago/shared";
import { FilterBar, filterInput, Pagination, Table, Td } from "@/components/admin/table";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Badge, PageHeader } from "@/components/ui/misc";
import { pageParam } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Пользователи" };

const PAGE = 30;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string; deleted?: string }> }) {
  const actor = await requireAdmin("users.read");
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const q = sp.q?.trim().slice(0, 100);
  const where: Prisma.UserWhereInput = {
    ...(sp.role ? { role: { key: sp.role } } : {}),
    ...(sp.status && sp.status in USER_STATUS_LABELS ? { status: sp.status as keyof typeof USER_STATUS_LABELS } : {}),
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { profile: { lastName: { contains: q, mode: "insensitive" } } },
            { profile: { firstName: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [users, total, roles] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ role: { level: "desc" } }, { profile: { lastName: "asc" } }],
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true,
        email: true,
        status: true,
        totpEnabledAt: true,
        lastLoginAt: true,
        role: { select: { name: true, level: true } },
        profile: { select: { firstName: true, lastName: true, position: true } },
        telegramAccount: { select: { id: true } },
        emailAccount: { select: { address: true } },
      },
    }),
    db.user.count({ where }),
    db.role.findMany({ orderBy: { level: "desc" } }),
  ]);
  const makeHref = (p: number) => `/admin/users?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.role ? { role: sp.role } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Пользователи"
        description={`Всего: ${total}`}
        actions={actor.can("users.manage") ? <ButtonLink href="/admin/users/new">Добавить пользователя</ButtonLink> : undefined}
      />
      {sp.deleted && <p className="mb-4 rounded-xl bg-[#e7f5ec] px-4 py-3 text-sm text-success">Пользователь удалён.</p>}
      <FilterBar>
        <input name="q" defaultValue={sp.q} placeholder="Имя или email" aria-label="Поиск" className={`${filterInput} sm:w-64`} />
        <select name="role" defaultValue={sp.role ?? ""} aria-label="Роль" className={filterInput}>
          <option value="">Все роли</option>
          {roles.map((r) => (
            <option key={r.key} value={r.key}>
              {r.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Статус" className={filterInput}>
          <option value="">Все статусы</option>
          {Object.entries(USER_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className={buttonClass("secondary", "sm")}>Найти</button>
      </FilterBar>
      <Table headers={["Имя", "Роль", "Статус", "Безопасность", "Последний вход"]}>
        {users.map((u) => (
          <tr key={u.id} className="hover:bg-paper/60">
            <Td>
              <Link href={`/admin/users/${u.id}`} className="font-semibold hover:text-fire">
                {u.profile ? fullName(u.profile) : "—"}
              </Link>
              <p className="text-xs text-muted">{u.email}</p>
              {u.emailAccount && <p className="text-xs text-muted">{u.emailAccount.address}</p>}
            </Td>
            <Td>
              {u.role.name}
              {u.profile?.position && <p className="text-xs text-muted">{u.profile.position}</p>}
            </Td>
            <Td>
              <Badge tone={u.status === "ACTIVE" ? "success" : u.status === "INVITED" ? "water" : "neutral"}>{USER_STATUS_LABELS[u.status]}</Badge>
            </Td>
            <Td>
              <div className="flex flex-wrap gap-1">
                {u.totpEnabledAt ? <Badge tone="success">2FA</Badge> : u.role.level >= 40 ? <Badge tone="warning">без 2FA</Badge> : null}
                {u.telegramAccount && <Badge tone="water">Telegram</Badge>}
              </div>
            </Td>
            <Td className="text-muted">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}</Td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / PAGE)} makeHref={makeHref} />
    </>
  );
}
