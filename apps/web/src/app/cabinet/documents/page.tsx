import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { db } from "@drago/database";
import { visibleDocumentsWhere } from "@drago/core";
import { DocumentRow } from "@/components/cabinet/items";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Документы" };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }) {
  const user = await requireUser();
  const { category, q } = await searchParams;
  const categories = await db.documentCategory.findMany({
    where: { minRoleLevel: { lte: user.level } },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { documents: { where: { OR: [{ minRoleLevel: null }, { minRoleLevel: { lte: user.level } }] } } } } },
  });
  const docs = await db.document.findMany({
    where: {
      ...visibleDocumentsWhere(user.level),
      ...(category ? { category: { slug: category, minRoleLevel: { lte: user.level } } } : {}),
      ...(q ? { title: { contains: q.slice(0, 100), mode: "insensitive" as const } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { category: { select: { name: true } }, file: { select: { size: true, mimeType: true } } },
  });
  return (
    <>
      <PageHeader
        title="Документы"
        description="Положения, инструкции, расписания и методички отряда. Доступ зависит от роли."
        actions={user.can("documents.manage") ? <ButtonLink href="/admin/documents" size="sm">Управление</ButtonLink> : undefined}
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <nav aria-label="Категории" className="flex flex-wrap gap-2">
          <a href="/cabinet/documents" className={`rounded-full px-3 py-1.5 text-sm font-medium ${!category ? "bg-ink text-paper" : "bg-white hover:bg-paper-2"}`}>
            Все
          </a>
          {categories.map((c) => (
            <a
              key={c.id}
              href={`/cabinet/documents?category=${c.slug}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${category === c.slug ? "bg-ink text-paper" : "bg-white hover:bg-paper-2"}`}
            >
              {c.name} <span className="opacity-60">{c._count.documents}</span>
            </a>
          ))}
        </nav>
        <form className="sm:ml-auto" role="search">
          {category && <input type="hidden" name="category" value={category} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Поиск по названию"
            aria-label="Поиск документов"
            className="w-full rounded-xl border border-line bg-white px-3.5 py-2 text-sm sm:w-64"
          />
        </form>
      </div>
      {docs.length === 0 ? (
        <EmptyState title="Документов не найдено" icon={<FileText className="size-8" />} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {docs.map((d) => (
            <DocumentRow key={d.id} d={d} />
          ))}
        </ul>
      )}
    </>
  );
}
