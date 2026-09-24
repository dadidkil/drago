"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@drago/database";
import { audit } from "@drago/core";
import { slugify } from "@drago/shared";
import { userAction, UserError, zf } from "@/lib/actions";
import { uniqueSlug } from "@/lib/admin";
import { deleteFileAsset, storeUpload } from "@/lib/uploads";

export const uploadDocument = userAction(
  {
    permission: "documents.manage",
    schema: z.object({
      title: zf.str(2, 200, "Укажите название"),
      description: zf.optStr(1000),
      categoryId: zf.id(),
      minRoleLevel: z.preprocess((v) => (v === "" ? undefined : v), zf.int(10, 100).optional()),
      file: z.instanceof(File, { message: "Выберите файл" }),
    }),
  },
  async (d, { user, ip }) => {
    const category = await db.documentCategory.findUnique({ where: { id: d.categoryId } });
    if (!category) throw new UserError("Категория не найдена");
    const asset = await storeUpload(d.file, { kind: "document", visibility: "INTERNAL", uploadedById: user.id });
    const doc = await db.document.create({
      data: { title: d.title, description: d.description, categoryId: category.id, fileId: asset.id, minRoleLevel: d.minRoleLevel ?? null, uploadedById: user.id },
    });
    await audit({ actorId: user.id, action: "document.upload", entity: "Document", entityId: doc.id, ipAddress: ip, metadata: { category: category.slug, mime: asset.mimeType, size: asset.size } });
    revalidatePath("/admin/documents");
    return { ok: true, message: "Документ загружен" };
  },
);

export const deleteDocument = userAction({ permission: "documents.manage", schema: z.object({ id: zf.id() }) }, async (d, { user, ip }) => {
  const doc = await db.document.findUnique({ where: { id: d.id } });
  if (!doc) throw new UserError("Не найдено");
  await deleteFileAsset(doc.fileId); // каскадно удалит Document
  await audit({ actorId: user.id, action: "document.delete", entity: "Document", entityId: d.id, ipAddress: ip, metadata: { title: doc.title } });
  revalidatePath("/admin/documents");
  return { ok: true };
});

export const saveCategory = userAction(
  {
    permission: "documents.manage",
    schema: z.object({ id: zf.id().optional(), name: zf.str(2, 80, "Укажите название"), description: zf.optStr(300), minRoleLevel: zf.int(10, 100), sortOrder: zf.optInt(0, 1000) }),
  },
  async (d, { user, ip }) => {
    const data = { name: d.name, description: d.description ?? null, minRoleLevel: d.minRoleLevel, sortOrder: d.sortOrder ?? 0 };
    const cat = d.id
      ? await db.documentCategory.update({ where: { id: d.id }, data })
      : await db.documentCategory.create({ data: { ...data, slug: await uniqueSlug(slugify(d.name), async (s) => Boolean(await db.documentCategory.findUnique({ where: { slug: s } }))) } });
    await audit({ actorId: user.id, action: d.id ? "document_category.update" : "document_category.create", entity: "DocumentCategory", entityId: cat.id, ipAddress: ip });
    revalidatePath("/admin/documents");
    return { ok: true, message: "Категория сохранена" };
  },
);

export const deleteCategory = userAction({ permission: "documents.manage", schema: z.object({ id: zf.id() }) }, async (d, { user, ip }) => {
  const count = await db.document.count({ where: { categoryId: d.id } });
  if (count > 0) throw new UserError("В категории есть документы — сначала удалите или перенесите их");
  await db.documentCategory.delete({ where: { id: d.id } });
  await audit({ actorId: user.id, action: "document_category.delete", entity: "DocumentCategory", entityId: d.id, ipAddress: ip });
  revalidatePath("/admin/documents");
  return { ok: true };
});
