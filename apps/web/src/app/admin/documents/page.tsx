import type { Metadata } from "next";
import { db } from "@drago/database";
import { audienceLabel, formatBytes, formatDate, fullName } from "@drago/shared";
import { Table, Td } from "@/components/admin/table";
import { InlineAction } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { fileUrl } from "@/lib/uploads";
import { deleteCategory, deleteDocument } from "./actions";
import { CategoryForm, UploadDocumentForm } from "./forms";

export const metadata: Metadata = { title: "Документы" };

export default async function AdminDocuments() {
  await requireAdmin("documents.manage");
  const [categories, docs] = await Promise.all([
    db.documentCategory.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { documents: true } } } }),
    db.document.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { category: true, file: { select: { size: true, originalName: true } }, uploadedBy: { select: { profile: true } } },
    }),
  ]);
  return (
    <>
      <PageHeader title="Документы" description="Внутренние материалы отряда. Скачивание — только после проверки прав по роли." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Загрузить документ</h2>
          <UploadDocumentForm categories={categories} />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Категории и доступ</h2>
          <div className="space-y-4">
            {categories.map((c) => (
              <div key={c.id} className="rounded-xl border border-line p-3">
                <CategoryForm category={c} />
                <div className="mt-2 flex items-center justify-between text-xs text-muted">
                  <span>
                    документов: {c._count.documents} · {audienceLabel(c.minRoleLevel)}
                  </span>
                  {c._count.documents === 0 && <InlineAction action={deleteCategory} fields={{ id: c.id }} label="Удалить" confirm="Удалить категорию?" />}
                </div>
              </div>
            ))}
            <div className="rounded-xl border border-dashed border-line p-3">
              <CategoryForm />
            </div>
          </div>
        </Card>
      </div>
      <h2 className="mt-8 mb-3 text-lg font-semibold">Все документы</h2>
      <Table headers={["Документ", "Категория", "Доступ", "Загружен", ""]}>
        {docs.map((d) => (
          <tr key={d.id}>
            <Td>
              <a href={fileUrl(d.fileId)} className="font-semibold hover:text-fire">
                {d.title}
              </a>
              <p className="text-xs text-muted">
                {d.file.originalName} · {formatBytes(d.file.size)}
              </p>
            </Td>
            <Td>{d.category.name}</Td>
            <Td>{audienceLabel(Math.max(d.category.minRoleLevel, d.minRoleLevel ?? 0))}</Td>
            <Td className="text-muted">
              {formatDate(d.createdAt)}
              {d.uploadedBy?.profile ? ` · ${fullName(d.uploadedBy.profile)}` : ""}
            </Td>
            <Td>
              <InlineAction action={deleteDocument} fields={{ id: d.id }} label="Удалить" confirm="Удалить документ?" />
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
