import "server-only";
import { db } from "@drago/database";
import { fullName } from "@drago/shared";

/** Активные пользователи для выпадающих списков (исполнители, участники, организаторы). */
export async function activeUserOptions() {
  const users = await db.user.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ role: { level: "desc" } }, { profile: { lastName: "asc" } }],
    select: { id: true, email: true, role: { select: { name: true } }, profile: { select: { firstName: true, lastName: true } } },
  });
  return users.map((u) => ({ id: u.id, name: u.profile ? fullName(u.profile) : u.email, role: u.role.name }));
}

/** Уникальный slug: при коллизии добавляется -2, -3… */
export async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  let slug = base;
  for (let i = 2; await exists(slug); i++) slug = `${base}-${i}`;
  return slug;
}

export function pageParam(v: string | undefined): number {
  return Math.max(1, Math.min(10_000, Number(v) || 1));
}
