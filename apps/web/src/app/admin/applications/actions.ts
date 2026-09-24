"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@drago/database";
import { audit } from "@drago/core";
import { emailSchema } from "@drago/shared";
import { userAction, UserError, zf } from "@/lib/actions";
import { createInvitedUser } from "@/lib/users";

export const updateApplication = userAction(
  {
    permission: "applications.manage",
    schema: z.object({ id: zf.id(), status: z.enum(["NEW", "CONTACTED", "INTERVIEW", "ACCEPTED", "DECLINED"]), notes: zf.optStr(4000) }),
  },
  async (d, { user, ip }) => {
    const app = await db.joinApplication.findUnique({ where: { id: d.id } });
    if (!app) throw new UserError("Заявка не найдена");
    await db.joinApplication.update({ where: { id: d.id }, data: { status: d.status, notes: d.notes ?? null, handledById: user.id } });
    if (app.status !== d.status) {
      await audit({ actorId: user.id, action: "application.status", entity: "JoinApplication", entityId: d.id, ipAddress: ip, metadata: { from: app.status, to: d.status } });
    }
    return { ok: true, message: "Сохранено" };
  },
);

/** Создать аккаунт кандидата/бойца по заявке и отправить приглашение. */
export const createAccountFromApplication = userAction(
  {
    permission: "users.manage",
    schema: z.object({ id: zf.id(), email: emailSchema, roleKey: z.enum(["CANDIDATE", "FIGHTER"]), lastName: zf.str(1, 60), firstName: zf.str(1, 60) }),
  },
  async (d, { user, ip }) => {
    const app = await db.joinApplication.findUnique({ where: { id: d.id } });
    if (!app) throw new UserError("Заявка не найдена");
    if (app.userId) throw new UserError("Аккаунт по этой заявке уже создан");
    const { user: created } = await createInvitedUser(user, { email: d.email, lastName: d.lastName, firstName: d.firstName, roleKey: d.roleKey }, ip, true);
    await db.joinApplication.update({ where: { id: app.id }, data: { userId: created.id, status: "ACCEPTED", handledById: user.id } });
    if (app.vkUserId) {
      // Сразу привязываем VK, если заявка пришла через VK-бот (пользователь сам писал сообществу).
      await db.vkAccount.create({ data: { userId: created.id, vkUserId: app.vkUserId } }).catch(() => undefined);
    }
    redirect(`/admin/users/${created.id}?created=1`);
  },
);

export const deleteApplication = userAction({ permission: "applications.manage", schema: z.object({ id: zf.id() }) }, async (d, { user, ip }) => {
  await db.joinApplication.delete({ where: { id: d.id } });
  await audit({ actorId: user.id, action: "application.delete", entity: "JoinApplication", entityId: d.id, ipAddress: ip });
  redirect("/admin/applications");
});
