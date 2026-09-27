import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@drago/database";
import { audit } from "@drago/core";
import { UserError } from "./actions";
import { deleteFileAsset, storeUpload } from "./uploads";

export const AVATAR_SIZE = 512;

/**
 * Заменить (file) или удалить (null) фото профиля пользователя.
 * Фото — внутреннее (видно только вошедшим), квадрат 512×512 WebP без метаданных; старый файл удаляется.
 */
export async function replaceAvatar(userId: string, file: File | null, actor: { id: string; ip: string | null }) {
  const profile = await db.profile.findUnique({ where: { userId }, select: { avatarFileId: true } });
  if (!profile) throw new UserError("Сначала заполните и сохраните имя в профиле");
  let avatarFileId: string | null = null;
  if (file) {
    if (file.size === 0) throw new UserError("Файл не выбран");
    avatarFileId = (await storeUpload(file, { kind: "image", visibility: "INTERNAL", uploadedById: actor.id, fit: { width: AVATAR_SIZE, height: AVATAR_SIZE } })).id;
  }
  await db.profile.update({ where: { userId }, data: { avatarFileId } });
  if (profile.avatarFileId && profile.avatarFileId !== avatarFileId) await deleteFileAsset(profile.avatarFileId).catch(() => undefined);
  await audit({
    actorId: actor.id,
    action: file ? "profile.avatar_set" : "profile.avatar_removed",
    entity: "User",
    entityId: userId,
    ipAddress: actor.ip,
    metadata: actor.id === userId ? undefined : { byAdmin: true },
  });
  // Аватар виден в шапке кабинета и админки — обновляем их layout.
  revalidatePath("/cabinet", "layout");
  revalidatePath("/admin", "layout");
}
