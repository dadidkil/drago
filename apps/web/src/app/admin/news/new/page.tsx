import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { NewsForm } from "../form";

export const metadata: Metadata = { title: "Новая новость" };

export default async function NewNews() {
  await requireAdmin("news.manage");
  return (
    <>
      <PageHeader title="Новая новость" />
      <Card>
        <NewsForm />
      </Card>
    </>
  );
}
