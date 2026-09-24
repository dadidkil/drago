import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@drago/database";
import { formatDate } from "@drago/shared";
import { Card } from "@/components/ui/misc";
import { Markdown } from "@/components/ui/markdown";
import { requireUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "База знаний" };

export default async function KnowledgeArticle({ params }: { params: Promise<{ slug: string }> }) {
  await requireUser();
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) notFound();
  const article = await db.page.findFirst({ where: { slug: `kb-${slug}`, isPublished: true } });
  if (!article) notFound();
  return (
    <>
      <Link href="/cabinet/knowledge" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-fire">
        <ArrowLeft className="size-4" aria-hidden /> База знаний
      </Link>
      <Card className="sm:p-8">
        <h1 className="text-2xl font-semibold sm:text-3xl">{article.title}</h1>
        <p className="mt-1 text-sm text-muted">обновлено {formatDate(article.updatedAt)}</p>
        <Markdown source={article.content} className="mt-6 [&_table]:block [&_table]:overflow-x-auto" />
      </Card>
    </>
  );
}
