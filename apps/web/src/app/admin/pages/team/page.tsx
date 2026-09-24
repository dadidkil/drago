import type { Metadata } from "next";
import { db } from "@drago/database";
import { InlineAction } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { deleteTeamMember } from "../actions";
import { TeamMemberForm } from "../forms";

export const metadata: Metadata = { title: "Командный состав" };

export default async function TeamAdmin() {
  await requireAdmin("pages.manage");
  const members = await db.teamMember.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return (
    <>
      <PageHeader title="Командный состав на сайте" description="Публичные карточки. Не связаны с внутренними аккаунтами и не раскрывают контакты." />
      <div className="space-y-4">
        {members.map((m) => (
          <Card key={m.id}>
            <TeamMemberForm m={m} />
            <div className="mt-3 border-t border-line pt-3">
              <InlineAction action={deleteTeamMember} fields={{ id: m.id }} label="Удалить карточку" confirm="Удалить карточку?" />
            </div>
          </Card>
        ))}
        <Card className="border-dashed">
          <h2 className="mb-3 font-semibold">Добавить</h2>
          <TeamMemberForm />
        </Card>
      </div>
    </>
  );
}
