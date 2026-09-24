import "server-only";
import { db } from "@drago/database";
import { appUrl, audit, inviteMail, isMailerConfigured, sendMail } from "@drago/core";
import { canManageLevel } from "@drago/shared";
import { UserError } from "./actions";
import type { CurrentUser } from "./auth/current-user";
import { issueAuthToken } from "./auth/tokens";

export interface NewUserInput {
  email: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  roleKey: string;
  position?: string;
  squadStatus?: string;
  joinedYear?: number;
}

/** Роль, которую актор вправе назначить (строго ниже своей; SUPERADMIN — любую). */
export async function assignableRole(actor: CurrentUser, roleKey: string) {
  const role = await db.role.findUnique({ where: { key: roleKey } });
  if (!role) throw new UserError("Роль не найдена", { roleKey: "Роль не найдена" });
  if (!actor.can("users.roles") && !["FIGHTER", "CANDIDATE"].includes(role.key)) {
    throw new UserError("Нет права назначать эту роль", { roleKey: "Недостаточно прав" });
  }
  if (!canManageLevel(actor.level, role.level)) throw new UserError("Нельзя назначить роль вашего уровня или выше", { roleKey: "Недостаточно прав" });
  return role;
}

/** Цель действия должна быть ниже актора по иерархии (и не сам актор). */
export async function manageableUser(actor: CurrentUser, userId: string) {
  const target = await db.user.findUnique({ where: { id: userId }, include: { role: true, profile: true } });
  if (!target) throw new UserError("Пользователь не найден");
  if (target.id === actor.id) throw new UserError("Это действие нельзя выполнить над собственным аккаунтом");
  if (!canManageLevel(actor.level, target.role.level)) throw new UserError("Недостаточно прав для управления этим пользователем");
  return target;
}

export async function createInvitedUser(actor: CurrentUser, input: NewUserInput, ip: string | null, sendInvite: boolean) {
  const role = await assignableRole(actor, input.roleKey);
  const exists = await db.user.findUnique({ where: { email: input.email } });
  if (exists) throw new UserError("Пользователь с таким email уже есть", { email: "Email уже используется" });
  const user = await db.user.create({
    data: {
      email: input.email,
      roleId: role.id,
      status: "INVITED",
      profile: {
        create: {
          lastName: input.lastName,
          firstName: input.firstName,
          middleName: input.middleName,
          position: input.position,
          squadStatus: input.squadStatus ?? (role.key === "CANDIDATE" ? "кандидат" : "боец"),
          joinedYear: input.joinedYear ?? new Date().getFullYear(),
        },
      },
    },
  });
  await audit({ actorId: actor.id, action: "user.create", entity: "User", entityId: user.id, ipAddress: ip, metadata: { role: role.key } });
  let mailed = false;
  if (sendInvite) mailed = await sendInviteEmail(user.id, actor, ip);
  return { user, mailed };
}

export async function sendInviteEmail(userId: string, actor: CurrentUser, ip: string | null): Promise<boolean> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true } });
  if (user.status !== "INVITED") throw new UserError("Пользователь уже активировал аккаунт");
  if (!isMailerConfigured() && process.env.NODE_ENV === "production") return false;
  const token = await issueAuthToken(user.id, "INVITE");
  await sendMail(inviteMail(user.email, appUrl(`/auth/invite?token=${token}`), user.profile?.firstName ?? ""));
  await audit({ actorId: actor.id, action: "user.invite_sent", entity: "User", entityId: user.id, ipAddress: ip });
  return true;
}
