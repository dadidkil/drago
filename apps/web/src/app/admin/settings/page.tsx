import type { Metadata } from "next";
import { db } from "@drago/database";
import { getSettings } from "@drago/core";
import { Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { MailSettingsForm, PermissionMatrix, SecurityForm } from "./forms";

export const metadata: Metadata = { title: "Настройки" };

export default async function SettingsPage() {
  await requireAdmin("settings.manage");
  const [s, roles, permissions] = await Promise.all([
    getSettings(["security", "privacy", "mail"]),
    db.role.findMany({ where: { key: { not: "SUPERADMIN" } }, orderBy: { level: "desc" }, include: { permissions: { include: { permission: true } } } }),
    db.permission.findMany({ orderBy: { key: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Настройки системы" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Безопасность и хранение данных</h2>
          <SecurityForm s={{ ...s.security, ...s.privacy }} />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Корпоративная почта</h2>
          <MailSettingsForm s={s.mail} />
        </Card>
      </div>
      <Card className="mt-6">
        <h2 className="mb-4 font-semibold">Роли и права</h2>
        <PermissionMatrix
          roles={roles.map((r) => ({ key: r.key, name: r.name }))}
          permissions={permissions}
          granted={Object.fromEntries(roles.map((r) => [r.key, r.permissions.map((rp) => rp.permission.key)]))}
        />
      </Card>
    </>
  );
}
