import { db } from "@drago/database";
import { OWNER_LEVEL, PERMISSION_KEYS, type PermissionKey } from "@drago/shared";

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { perms: Set<PermissionKey>; at: number }>();

/** Права роли (с кэшем в памяти процесса на 30 секунд). */
export async function getRolePermissions(roleId: string): Promise<Set<PermissionKey>> {
  const hit = cache.get(roleId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.perms;

  const role = await db.role.findUnique({
    where: { id: roleId },
    select: { level: true, permissions: { select: { permission: { select: { key: true } } } } },
  });
  let perms: Set<PermissionKey>;
  if (!role) perms = new Set();
  else perms = new Set(role.permissions.map((rp) => rp.permission.key as PermissionKey));

  cache.set(roleId, { perms, at: Date.now() });
  return perms;
}

/**
 * Права пользователя: у владельца системы (`isOwner`) — все, у остальных — права их роли.
 * Владелец при этом остаётся в отряде на обычной роли, вплоть до кандидата.
 */
export async function getUserPermissions(user: { roleId: string; isOwner: boolean }): Promise<Set<PermissionKey>> {
  if (user.isOwner) return new Set(PERMISSION_KEYS);
  return getRolePermissions(user.roleId);
}

/** Уровень в иерархии с поправкой на владельца: он выше любой роли. */
export function effectiveLevel(roleLevel: number, isOwner: boolean): number {
  return isOwner ? OWNER_LEVEL : roleLevel;
}

export function invalidatePermissionCache(): void {
  cache.clear();
}

/** Активные пользователи, у роли которых есть право permission. */
export async function findUsersWithPermission(permission: PermissionKey): Promise<string[]> {
  const users = await db.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ isOwner: true }, { role: { permissions: { some: { permission: { key: permission } } } } }],
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
