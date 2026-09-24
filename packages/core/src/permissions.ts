import { db } from "@drago/database";
import { PERMISSION_KEYS, ROLE_LEVELS, type PermissionKey } from "@drago/shared";

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { perms: Set<PermissionKey>; at: number }>();

/** Права роли (с кэшем в памяти процесса на 30 секунд). SUPERADMIN — всегда все права. */
export async function getRolePermissions(roleId: string): Promise<Set<PermissionKey>> {
  const hit = cache.get(roleId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.perms;

  const role = await db.role.findUnique({
    where: { id: roleId },
    select: { level: true, permissions: { select: { permission: { select: { key: true } } } } },
  });
  let perms: Set<PermissionKey>;
  if (!role) perms = new Set();
  else if (role.level >= ROLE_LEVELS.SUPERADMIN) perms = new Set(PERMISSION_KEYS);
  else perms = new Set(role.permissions.map((rp) => rp.permission.key as PermissionKey));

  cache.set(roleId, { perms, at: Date.now() });
  return perms;
}

export function invalidatePermissionCache(): void {
  cache.clear();
}

/** Активные пользователи, у роли которых есть право permission. */
export async function findUsersWithPermission(permission: PermissionKey): Promise<string[]> {
  const users = await db.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { role: { level: { gte: ROLE_LEVELS.SUPERADMIN } } },
        { role: { permissions: { some: { permission: { key: permission } } } } },
      ],
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
