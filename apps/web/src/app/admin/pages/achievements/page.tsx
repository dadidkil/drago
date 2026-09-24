import type { Metadata } from "next";
import { db } from "@drago/database";
import { InlineAction } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { deleteAchievement } from "../actions";
import { AchievementForm } from "../forms";

export const metadata: Metadata = { title: "Достижения" };

export default async function AchievementsAdmin() {
  await requireAdmin("pages.manage");
  const items = await db.achievement.findMany({ orderBy: [{ year: { sort: "desc", nulls: "last" } }, { sortOrder: "asc" }] });
  return (
    <>
      <PageHeader title="Достижения" description="Раздел появляется на главной, когда есть хотя бы одно опубликованное достижение." />
      <div className="space-y-4">
        {items.map((a) => (
          <Card key={a.id}>
            <AchievementForm a={a} />
            <div className="mt-3 border-t border-line pt-3">
              <InlineAction action={deleteAchievement} fields={{ id: a.id }} label="Удалить" confirm="Удалить?" />
            </div>
          </Card>
        ))}
        <Card className="border-dashed">
          <h2 className="mb-3 font-semibold">Добавить достижение</h2>
          <AchievementForm />
        </Card>
      </div>
    </>
  );
}
