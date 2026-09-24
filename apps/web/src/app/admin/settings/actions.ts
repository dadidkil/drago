"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@drago/database";
import { audit, invalidatePermissionCache, setSetting } from "@drago/core";
import { PERMISSION_KEYS } from "@drago/shared";
import { userAction, UserError, zf } from "@/lib/actions";

export const saveSecuritySettings = userAction(
  {
    permission: "settings.manage",
    schema: z.object({ requireStaff2fa: zf.bool(), applicationRetentionDays: zf.int(30, 1095), auditRetentionDays: zf.int(90, 1825) }),
  },
  async (d, { user, ip }) => {
    await setSetting("security", { requireStaff2fa: d.requireStaff2fa }, { id: user.id, ip });
    await setSetting("privacy", { applicationRetentionDays: d.applicationRetentionDays, auditRetentionDays: d.auditRetentionDays }, { id: user.id, ip });
    return { ok: true, message: "Сохранено" };
  },
);

export const saveMailSettings = userAction(
  {
    permission: "settings.manage",
    schema: z.object({
      domain: z.string().trim().min(3).max(100).regex(/^[a-z0-9.-]+$/i),
      webmailUrl: z.union([z.literal(""), z.url({ protocol: /^https$/ })]),
      imapHost: z.string().trim().max(100),
      smtpHost: z.string().trim().max(100),
    }),
  },
  async (d, { user, ip }) => {
    await setSetting("mail", d, { id: user.id, ip });
    return { ok: true, message: "Сохранено" };
  },
);

/** Матрица прав. SUPERADMIN всегда имеет все права и не редактируется. */
export const saveRolePermissions = userAction({ permission: "settings.manage", schema: z.object({}) }, async (_d, { user, ip, formData }) => {
  const roles = await db.role.findMany({ where: { key: { not: "SUPERADMIN" } } });
  const permissions = await db.permission.findMany();
  const permId = new Map(permissions.map((p) => [p.key, p.id]));
  const changes: Record<string, string[]> = {};
  for (const role of roles) {
    const selected = PERMISSION_KEYS.filter((k) => formData.get(`${role.key}:${k}`) === "on");
    if (selected.some((k) => k !== "admin.access") && !selected.includes("admin.access")) {
      throw new UserError(`Роль «${role.name}»: административные права требуют права «Вход в админ-панель»`);
    }
    changes[role.key] = selected;
    await db.$transaction([
      db.rolePermission.deleteMany({ where: { roleId: role.id } }),
      db.rolePermission.createMany({ data: selected.map((k) => ({ roleId: role.id, permissionId: permId.get(k)! })) }),
    ]);
  }
  invalidatePermissionCache();
  await audit({ actorId: user.id, action: "role.permissions_update", entity: "Role", ipAddress: ip, metadata: changes });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Матрица прав сохранена. Изменения применяются в течение 30 секунд во всех сервисах." };
});
