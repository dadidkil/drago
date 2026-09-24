import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@drago/database";
import { Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { PageForm } from "../../forms";

export const metadata: Metadata = { title: "Страница" };
const EDITABLE = ["about", "history", "traditions", "join", "privacy"];

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin("pages.manage");
  const { slug } = await params;
  if (!EDITABLE.includes(slug)) notFound();
  const page = (await db.page.findUnique({ where: { slug } })) ?? { slug, title: slug, content: "", seoTitle: null, seoDescription: null, isPublished: false };
  return (
    <>
      <Link href="/admin/pages" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-fire">
        <ArrowLeft className="size-4" aria-hidden /> Контент сайта
      </Link>
      <PageHeader title={page.title} />
      <Card>
        <PageForm page={page} />
      </Card>
    </>
  );
}
