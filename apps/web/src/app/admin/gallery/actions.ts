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

export const saveGallery = userAction(
  {
    permission: "gallery.manage",
    schema: z.object({
      id: zf.id().optional(),
      title: zf.str(2, 150, "Укажите название"),
      description: zf.optStr(1000),
      eventDate: zf.optDateMsk(),
      isPublished: zf.bool(),
      sortOrder: zf.optInt(0, 10000),
    }),
  },
  async (d, { user, ip }) => {
    const data = { title: d.title, description: d.description ?? null, eventDate: d.eventDate ?? null, isPublished: d.isPublished, sortOrder: d.sortOrder ?? 0 };
    const g = d.id
      ? await db.gallery.update({ where: { id: d.id }, data })
      : await db.gallery.create({ data: { ...data, slug: await uniqueSlug(slugify(d.title), async (s) => Boolean(await db.gallery.findUnique({ where: { slug: s } }))) } });
    await audit({ actorId: user.id, action: d.id ? "gallery.update" : "gallery.create", entity: "Gallery", entityId: g.id, ipAddress: ip, metadata: { published: d.isPublished } });
    revalidatePath("/gallery");
    if (!d.id) redirect(`/admin/gallery/${g.id}`);
    return { ok: true, message: "Сохранено" };
  },
);

export const uploadPhotos = userAction(
  { permission: "gallery.manage", schema: z.object({ galleryId: zf.id(), photos: z.array(z.instanceof(File)).max(30, "Не больше 30 фото за раз").default([]) }) },
  async (d, { user, ip }) => {
    const files = d.photos.filter((f) => f.size > 0);
    if (files.length === 0) throw new UserError("Выберите фото");
    const max = await db.photo.aggregate({ where: { galleryId: d.galleryId }, _max: { sortOrder: true } });
    let order = (max._max.sortOrder ?? 0) + 1;
    for (const file of files) {
      const asset = await storeUpload(file, { kind: "image", visibility: "PUBLIC", uploadedById: user.id });
      await db.photo.create({ data: { galleryId: d.galleryId, fileId: asset.id, sortOrder: order++ } });
    }
    await audit({ actorId: user.id, action: "gallery.photos_upload", entity: "Gallery", entityId: d.galleryId, ipAddress: ip, metadata: { count: files.length } });
    revalidatePath(`/admin/gallery/${d.galleryId}`);
    return { ok: true, message: `Загружено фото: ${files.length}` };
  },
);

export const updatePhoto = userAction(
  { permission: "gallery.manage", schema: z.object({ id: zf.id(), caption: zf.optStr(300), makeCover: zf.bool() }) },
  async (d) => {
    const photo = await db.photo.update({ where: { id: d.id }, data: { caption: d.caption ?? null } });
    if (d.makeCover) {
      await db.$transaction([
        db.photo.updateMany({ where: { galleryId: photo.galleryId }, data: { isCover: false } }),
        db.photo.update({ where: { id: d.id }, data: { isCover: true } }),
      ]);
    }
    return { ok: true, message: "Сохранено" };
  },
);

export const deletePhoto = userAction({ permission: "gallery.manage", schema: z.object({ id: zf.id() }) }, async (d, { user, ip }) => {
  const photo = await db.photo.findUnique({ where: { id: d.id } });
  if (!photo) throw new UserError("Не найдено");
  await deleteFileAsset(photo.fileId);
  await audit({ actorId: user.id, action: "gallery.photo_delete", entity: "Gallery", entityId: photo.galleryId, ipAddress: ip });
  return { ok: true };
});

export const deleteGallery = userAction({ permission: "gallery.manage", schema: z.object({ id: zf.id() }) }, async (d, { user, ip }) => {
  const photos = await db.photo.findMany({ where: { galleryId: d.id }, select: { fileId: true } });
  for (const p of photos) await deleteFileAsset(p.fileId);
  await db.gallery.delete({ where: { id: d.id } });
  await audit({ actorId: user.id, action: "gallery.delete", entity: "Gallery", entityId: d.id, ipAddress: ip, metadata: { photos: photos.length } });
  redirect("/admin/gallery");
});
