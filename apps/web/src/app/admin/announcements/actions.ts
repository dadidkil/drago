"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@drago/database";
import { audit, notifyAudience } from "@drago/core";
import { truncate } from "@drago/shared";
import { userAction, UserError, zf } from "@/lib/actions";
import { deleteFileAsset, storeUpload } from "@/lib/uploads";

const schema = z.object({
  id: zf.id().optional(),
  title: zf.str(3, 150, "Укажите заголовок"),
  body: zf.str(1, 10000, "Напишите текст"),
  pinned: zf.bool(),
  minRoleLevel: zf.int(10, 100),
  expiresAt: zf.optDateMsk(),
  notifyUsers: zf.bool(),
  files: zf.files(),
});

export const saveAnnouncement = userAction({ permission: "announcements.manage", schema }, async (d, { user, ip }) => {
  const data = { title: d.title, body: d.body, pinned: d.pinned, minRoleLevel: d.minRoleLevel, expiresAt: d.expiresAt ?? null };
  const item = d.id
    ? await db.announcement.update({ where: { id: d.id }, data })
    : await db.announcement.create({ data: { ...data, authorId: user.id } });
  for (const file of d.files.filter((f) => f.size > 0).slice(0, 10)) {
    const asset = await storeUpload(file, { kind: "attachment", visibility: "INTERNAL", uploadedById: user.id });
    await db.fileAsset.update({ where: { id: asset.id }, data: { announcementId: item.id } });
  }
  await audit({ actorId: user.id, action: d.id ? "announcement.update" : "announcement.create", entity: "Announcement", entityId: item.id, ipAddress: ip });
  if (!d.id || d.notifyUsers) {
    await notifyAudience(d.minRoleLevel, {
      type: "ANNOUNCEMENT",
      title: d.title,
      body: truncate(d.body.replace(/[#*_>`[\]]/g, ""), 500),
      url: "/cabinet/announcements",
      excludeUserId: user.id,
    });
  }
  revalidatePath("/cabinet/announcements");
  redirect(`/admin/announcements?saved=1`);
});

export const deleteAnnouncement = userAction({ permission: "announcements.manage", schema: z.object({ id: zf.id() }) }, async (d, { user, ip }) => {
  const item = await db.announcement.findUnique({ where: { id: d.id }, include: { attachments: { select: { id: true } } } });
  if (!item) throw new UserError("Не найдено");
  for (const a of item.attachments) await deleteFileAsset(a.id);
  await db.announcement.delete({ where: { id: d.id } });
  await audit({ actorId: user.id, action: "announcement.delete", entity: "Announcement", entityId: d.id, ipAddress: ip });
  revalidatePath("/admin/announcements");
  return { ok: true };
});

export const removeAttachment = userAction({ permission: "announcements.manage", schema: z.object({ fileId: zf.id() }) }, async (d, { user, ip }) => {
  const f = await db.fileAsset.findUnique({ where: { id: d.fileId } });
  if (!f?.announcementId) throw new UserError("Не найдено");
  await deleteFileAsset(f.id);
  await audit({ actorId: user.id, action: "announcement.attachment_delete", entity: "Announcement", entityId: f.announcementId, ipAddress: ip });
  return { ok: true };
});
