import type { Metadata } from "next";
import { db } from "@drago/database";
import { InlineAction } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { deleteFaq } from "../actions";
import { FaqForm } from "../forms";

export const metadata: Metadata = { title: "FAQ" };

export default async function FaqAdmin() {
  await requireAdmin("pages.manage");
  const items = await db.faqItem.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return (
    <>
      <PageHeader title="Частые вопросы" />
      <div className="space-y-4">
        {items.map((f) => (
          <Card key={f.id}>
            <FaqForm f={f} />
            <div className="mt-3 border-t border-line pt-3">
              <InlineAction action={deleteFaq} fields={{ id: f.id }} label="Удалить" confirm="Удалить вопрос?" />
            </div>
          </Card>
        ))}
        <Card className="border-dashed">
          <h2 className="mb-3 font-semibold">Добавить вопрос</h2>
          <FaqForm />
        </Card>
      </div>
    </>
  );
}
