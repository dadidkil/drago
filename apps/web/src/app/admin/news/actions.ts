"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@drago/database";
import { audit } from "@drago/core";
import { slugify } from "@drago/shared";
import { userAction, UserError, zf } from "@/lib/actions";
import { uniqueSlug } from "@/lib/admin";
import { deleteFileAsset, storeUpload } from "@/lib/uploads";

const schema = z.object({
  id: zf.id().optional(),
  title: zf.str(3, 200, "Укажите заголовок"),
  slug: zf.slug(),
  excerpt: zf.optStr(400),
  content: zf.str(1, 50000, "Напишите текст"),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  publishedAt: zf.optDateMsk(),
  cover: zf.file(),
  removeCover: zf.bool(),
});

export const saveNews = userAction({ permission: "news.manage", schema }, async (d, { user, ip }) => {
  const before = d.id ? await db.news.findUnique({ where: { id: d.id } }) : null;
  if (d.id && !before) throw new UserError("Новость не найдена");
  const slug = await uniqueSlug(d.slug ?? slugify(d.title), async (s) => {
    const found = await db.news.findUnique({ where: { slug: s }, select: { id: true } });
    return Boolean(found && found.id !== d.id);
  });
  let coverFileId = before?.coverFileId ?? null;
  const oldCover = coverFileId;
  if (d.cover && d.cover.size > 0) coverFileId = (await storeUpload(d.cover, { kind: "image", visibility: "PUBLIC", uploadedById: user.id })).id;
  else if (d.removeCover) coverFileId = null;

  const publishedAt = d.status === "PUBLISHED" ? (d.publishedAt ?? before?.publishedAt ?? new Date()) : (d.publishedAt ?? before?.publishedAt ?? null);
  const data = { title: d.title, slug, excerpt: d.excerpt ?? null, content: d.content, status: d.status, publishedAt, coverFileId };
  const item = d.id ? await db.news.update({ where: { id: d.id }, data }) : await db.news.create({ data: { ...data, authorId: user.id } });
  if (oldCover && oldCover !== coverFileId) await deleteFileAsset(oldCover);

  const published = d.status === "PUBLISHED" && before?.status !== "PUBLISHED";
  await audit({ actorId: user.id, action: published ? "news.publish" : d.id ? "news.update" : "news.create", entity: "News", entityId: item.id, ipAddress: ip, metadata: { status: d.status } });
  revalidatePath("/news");
  revalidatePath("/");
  redirect(`/admin/news/${item.id}?saved=1`);
});

export const deleteNews = userAction({ permission: "news.manage", schema: z.object({ id: zf.id() }) }, async (d, { user, ip }) => {
  const item = await db.news.findUnique({ where: { id: d.id } });
  if (!item) throw new UserError("Не найдено");
  await db.news.delete({ where: { id: d.id } });
  if (item.coverFileId) await deleteFileAsset(item.coverFileId);
  await audit({ actorId: user.id, action: "news.delete", entity: "News", entityId: d.id, ipAddress: ip, metadata: { title: item.title } });
  redirect("/admin/news");
});
