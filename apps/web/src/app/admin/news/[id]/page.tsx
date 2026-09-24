import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@drago/database";
import { InlineAction } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { deleteNews } from "../actions";
import { NewsForm } from "../form";

export const metadata: Metadata = { title: "Новость" };

export default async function EditNews({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin("news.manage");
  const item = await db.news.findUnique({ where: { id: (await params).id } });
  if (!item) notFound();
  const { saved } = await searchParams;
  return (
    <>
      <Link href="/admin/news" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-fire">
        <ArrowLeft className="size-4" aria-hidden /> Новости
      </Link>
      <PageHeader title={item.title} actions={<InlineAction action={deleteNews} fields={{ id: item.id }} label="Удалить" variant="danger" confirm="Удалить новость?" />} />
      {saved && <p className="mb-4 rounded-xl bg-[#e7f5ec] px-4 py-3 text-sm text-success">Сохранено.</p>}
      <Card>
        <NewsForm item={item} />
      </Card>
    </>
  );
}
