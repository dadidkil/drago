import type { Metadata } from "next";
import { db } from "@drago/database";
import { canManageLevel } from "@drago/shared";
import { Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { NewUserForm } from "../user-forms";

export const metadata: Metadata = { title: "Новый пользователь" };

export default async function NewUserPage() {
  const actor = await requireAdmin("users.manage");
  const roles = (await db.role.findMany({ orderBy: { level: "desc" } })).filter(
    (r) => canManageLevel(actor.level, r.level) && (actor.can("users.roles") || ["FIGHTER", "CANDIDATE"].includes(r.key)),
  );
  return (
    <>
      <PageHeader title="Новый пользователь" description="Аккаунт создаётся без пароля: пользователь задаёт его сам по ссылке-приглашению." />
      <Card className="max-w-3xl">
        <NewUserForm roles={roles.map((r) => ({ key: r.key, name: r.name }))} />
      </Card>
    </>
  );
}
