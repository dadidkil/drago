"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@drago/database";
import { audit, getSetting, setSetting } from "@drago/core";
import { userAction, UserError, zf } from "@/lib/actions";
import { deleteFileAsset, storeUpload } from "@/lib/uploads";

const P = "pages.manage" as const;
const MAX = 12;

function refresh() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/pages/media");
}

/** Фото сайта: публичные, перекодируются в WebP, метаданные (геолокация и пр.) удаляются при загрузке. */
export const uploadSitePhotos = userAction(
  { permission: P, schema: z.object({ photos: z.array(z.instanceof(File)).max(MAX, `Не больше ${MAX} фото за раз`).default([]) }) },
  async (d, { user, ip }) => {
    const files = d.photos.filter((f) => f.size > 0);
    if (files.length === 0) throw new UserError("Выберите фото");
    const media = await getSetting("site.media");
    if (media.photos.length + files.length > MAX) throw new UserError(`На сайте может быть не больше ${MAX} фото — удалите лишние`);
    const added: string[] = [];
    for (const file of files) {
      const asset = await storeUpload(file, { kind: "image", visibility: "PUBLIC", uploadedById: user.id });
      added.push(asset.id);
    }
    const photos = [...media.photos, ...added.map((fileId) => ({ fileId, alt: "" }))];
    await setSetting("site.media", { photos, heroFileId: media.heroFileId ?? added[0] ?? null }, { id: user.id, ip });
    await audit({ actorId: user.id, action: "site_media.upload", entity: "Setting", entityId: "site.media", ipAddress: ip, metadata: { count: added.length } });
    refresh();
    return { ok: true, message: `Загружено: ${added.length}` };
  },
);

export const updateSitePhoto = userAction(
  { permission: P, schema: z.object({ fileId: zf.id(), alt: zf.optStr(200), hero: zf.bool(), move: z.enum(["up", "down", ""]).optional() }) },
  async (d, { user, ip }) => {
    const media = await getSetting("site.media");
    const i = media.photos.findIndex((p) => p.fileId === d.fileId);
    if (i < 0) throw new UserError("Фото не найдено");
    const photos = media.photos.map((p) => (p.fileId === d.fileId ? { ...p, alt: d.alt ?? "" } : p));
    const j = d.move === "up" ? i - 1 : d.move === "down" ? i + 1 : i;
    if (j !== i && j >= 0 && j < photos.length) [photos[i], photos[j]] = [photos[j]!, photos[i]!];
    const heroFileId = d.hero ? d.fileId : media.heroFileId === d.fileId ? null : media.heroFileId;
    await setSetting("site.media", { photos, heroFileId }, { id: user.id, ip });
    refresh();
    return { ok: true, message: "Сохранено" };
  },
);

export const deleteSitePhoto = userAction({ permission: P, schema: z.object({ fileId: zf.id() }) }, async (d, { user, ip }) => {
  const media = await getSetting("site.media");
  if (!media.photos.some((p) => p.fileId === d.fileId)) throw new UserError("Фото не найдено");
  const photos = media.photos.filter((p) => p.fileId !== d.fileId);
  await setSetting("site.media", { photos, heroFileId: media.heroFileId === d.fileId ? (photos[0]?.fileId ?? null) : media.heroFileId }, { id: user.id, ip });
  // Файл удаляем, только если он больше нигде не используется (галерея, команда).
  const used = await db.fileAsset.findUnique({ where: { id: d.fileId }, select: { photo: { select: { id: true } }, teamPhoto: { select: { id: true } } } });
  if (used && !used.photo && !used.teamPhoto) await deleteFileAsset(d.fileId).catch(() => undefined);
  await audit({ actorId: user.id, action: "site_media.delete", entity: "Setting", entityId: "site.media", ipAddress: ip });
  refresh();
  return { ok: true, message: "Удалено" };
});
