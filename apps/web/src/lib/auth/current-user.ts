import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getRolePermissions, getSetting } from "@drago/core";
import { STAFF_LEVEL, type PermissionKey } from "@drago/shared";
import { getSession, type CurrentSession } from "./session";

export interface CurrentUser {
  id: string;
  email: string;
  session: CurrentSession;
  role: { id: string; key: string; name: string; level: number };
  level: number;
  permissions: Set<PermissionKey>;
  profile: CurrentSession["user"]["profile"];
  has2fa: boolean;
  emailVerified: boolean;
  can: (p: PermissionKey) => boolean;
}

/** Текущий пользователь (или null). Учитывает статус и незавершённую 2FA. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;
  const { user } = session;
  if (user.status !== "ACTIVE") return null;
  const has2fa = Boolean(user.totpEnabledAt);
  if (has2fa && !session.twoFactorVerified) return null;
  const permissions = await getRolePermissions(user.roleId);
  return {
    id: user.id,
    email: user.email,
    session,
    role: user.role,
    level: user.role.level,
    permissions,
    profile: user.profile,
    has2fa,
    emailVerified: Boolean(user.emailVerifiedAt),
    can: (p) => permissions.has(p),
  };
});

/** Для страниц кабинета: без сессии — на /login, с незавершённой 2FA — на /auth/2fa. */
export async function requireUser(nextPath?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user) return user;
  const session = await getSession();
  if (session && session.user.status === "ACTIVE" && session.user.totpEnabledAt && !session.twoFactorVerified) {
    redirect("/auth/2fa");
  }
  redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
}

/** Для страниц админки: право admin.access + (при включённой политике) обязательная 2FA для командного состава. */
export async function requireAdmin(permission?: PermissionKey): Promise<CurrentUser> {
  const user = await requireUser("/admin/dashboard");
  if (!user.can("admin.access")) redirect("/forbidden");
  if (permission && !user.can(permission)) redirect("/forbidden");
  if (user.level >= STAFF_LEVEL && !user.has2fa) {
    const security = await getSetting("security");
    if (security.requireStaff2fa) redirect("/cabinet/security?require2fa=1");
  }
  return user;
}

export class ForbiddenError extends Error {
  constructor(message = "Недостаточно прав") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Для server actions: бросает ForbiddenError вместо редиректа. */
export async function authorize(permission?: PermissionKey, opts: { admin?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Требуется вход");
  if (opts.admin || permission) {
    if (!user.can("admin.access") && opts.admin) throw new ForbiddenError();
    if (permission && !user.can(permission)) throw new ForbiddenError();
    if (user.level >= STAFF_LEVEL && !user.has2fa && opts.admin) {
      const security = await getSetting("security");
      if (security.requireStaff2fa) throw new ForbiddenError("Включите двухфакторную аутентификацию");
    }
  }
  return user;
}
