import type { Context } from "grammy";
import { getRolePermissions, userWithLevel } from "@drago/core";
import { db } from "@drago/database";
import type { PermissionKey } from "@drago/shared";

export type LinkedUser = NonNullable<Awaited<ReturnType<typeof userWithLevel>>> & {
  permissions: Set<PermissionKey>;
  can: (p: PermissionKey) => boolean;
};

export interface BotContext extends Context {
  linked: LinkedUser | null;
}

/** Пользователь определяется ТОЛЬКО по числовому Telegram user ID (не по username). */
export async function resolveLinkedUser(telegramUserId: number): Promise<LinkedUser | null> {
  const account = await db.telegramAccount.findUnique({ where: { telegramUserId: BigInt(telegramUserId) }, select: { userId: true, blockedBot: true } });
  if (!account) return null;
  if (account.blockedBot) {
    await db.telegramAccount.update({ where: { telegramUserId: BigInt(telegramUserId) }, data: { blockedBot: false } });
  }
  const user = await userWithLevel(account.userId);
  if (!user) return null;
  const role = await db.role.findUnique({ where: { key: user.role.key }, select: { id: true } });
  const permissions = role ? await getRolePermissions(role.id) : new Set<PermissionKey>();
  return { ...user, permissions, can: (p) => permissions.has(p) };
}
