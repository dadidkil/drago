import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { db } from "@drago/database";
import { formatDate } from "@drago/shared";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";
import { markdownToText } from "@/lib/markdown";

export const metadata: Metadata = { title: "База знаний" };

export default async function KnowledgePage() {
  const user = await requireUser();
  const articles = await db.page.findMany({
    where: { slug: { startsWith: "kb-" }, isPublished: true },
    orderBy: { title: "asc" },
  });
  return (
    <>
      <PageHeader
        title="База знаний"
        description="Материалы для бойцов: РСО, трудоустройство, подготовка к конкурсам. Видны только в кабинете."
        actions={user.can("pages.manage") ? <ButtonLink href="/admin/pages#knowledge" size="sm">Редактировать</ButtonLink> : undefined}
      />
      {articles.length === 0 ? (
        <EmptyState title="Статей пока нет" icon={<BookOpen className="size-8" />} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {articles.map((a) => (
            <li key={a.slug}>
              <Link href={`/cabinet/knowledge/${a.slug.slice(3)}`} className="block h-full rounded-2xl border border-line bg-white p-5 transition-colors hover:border-fire/50">
                <p className="font-display text-lg font-semibold">{a.title}</p>
                <p className="mt-2 line-clamp-3 text-sm text-muted">{markdownToText(a.content, 220)}</p>
                <p className="mt-3 text-xs text-muted">обновлено {formatDate(a.updatedAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
