"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, type NotificationChannel, type NotificationType } from "@drago/database";
import { audit, rateLimit, sendMail, verifyEmailMail, appUrl } from "@drago/core";
import { EXTERNAL_CHANNELS, NOTIFICATION_META, NOTIFICATION_TYPES } from "@drago/shared";
import { userAction, UserError, zf } from "@/lib/actions";
import { issueAuthToken } from "@/lib/auth/tokens";
import { deleteFileAsset, storeUpload } from "@/lib/uploads";

const nameRe = /^[A-Za-zА-Яа-яЁё\s'-]+$/;

export const updateProfile = userAction(
  {
    schema: z.object({
      lastName: zf.str(1, 60, "Укажите фамилию").regex(nameRe, "Только буквы"),
      firstName: zf.str(1, 60, "Укажите имя").regex(nameRe, "Только буквы"),
      middleName: zf.optStr(60),
      phone: zf.optStr(30).refine((v) => !v || /^[+\d\s()-]{6,30}$/.test(v), "Неверный формат телефона"),
      bio: zf.optStr(500),
      avatar: zf.file(),
      removeAvatar: zf.bool(),
    }),
  },
  async (d, { user, ip }) => {
    let avatarFileId = user.profile?.avatarFileId ?? null;
    const oldAvatar = avatarFileId;
    if (d.avatar && d.avatar.size > 0) {
      const asset = await storeUpload(d.avatar, { kind: "image", visibility: "INTERNAL", uploadedById: user.id });
      avatarFileId = asset.id;
    } else if (d.removeAvatar) {
      avatarFileId = null;
    }
    await db.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, lastName: d.lastName, firstName: d.firstName, middleName: d.middleName, phone: d.phone, bio: d.bio, avatarFileId },
      update: { lastName: d.lastName, firstName: d.firstName, middleName: d.middleName ?? null, phone: d.phone ?? null, bio: d.bio ?? null, avatarFileId },
    });
    if (oldAvatar && oldAvatar !== avatarFileId) await deleteFileAsset(oldAvatar);
    await audit({ actorId: user.id, action: "profile.update", entity: "User", entityId: user.id, ipAddress: ip });
    revalidatePath("/cabinet", "layout");
    return { ok: true, message: "Профиль сохранён" };
  },
);

export const resendEmailVerification = userAction({ schema: z.object({}) }, async (_d, { user }) => {
  if (user.emailVerified) return { ok: true, message: "Email уже подтверждён" };
  const limit = await rateLimit(`verify-mail:${user.id}`, 3, 3600);
  if (!limit.ok) throw new UserError("Письмо уже отправлено. Попробуйте через час.");
  const token = await issueAuthToken(user.id, "EMAIL_VERIFY");
  await sendMail(verifyEmailMail(user.email, appUrl(`/auth/verify-email?token=${token}`)));
  return { ok: true, message: `Письмо отправлено на ${user.email}` };
});

export const updateNotificationPrefs = userAction({ schema: z.object({}) }, async (_d, { user, formData }) => {
  const rows: { userId: string; type: NotificationType; channel: NotificationChannel; enabled: boolean }[] = [];
  for (const type of NOTIFICATION_TYPES) {
    if (!NOTIFICATION_META[type].configurable) continue;
    for (const channel of EXTERNAL_CHANNELS) {
      rows.push({ userId: user.id, type, channel, enabled: formData.get(`${type}:${channel}`) === "on" });
    }
  }
  await db.$transaction([
    db.notificationPreference.deleteMany({ where: { userId: user.id } }),
    db.notificationPreference.createMany({ data: rows }),
  ]);
  return { ok: true, message: "Настройки уведомлений сохранены" };
});
