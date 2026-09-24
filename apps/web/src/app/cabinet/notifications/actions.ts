"use server";

import { z } from "zod";
import { db } from "@drago/database";
import { userAction, zf } from "@/lib/actions";

export const markAllRead = userAction({ schema: z.object({}) }, async (_d, { user }) => {
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return { ok: true, message: "Все уведомления прочитаны" };
});

export const markRead = userAction({ schema: z.object({ id: zf.id() }) }, async (d, { user }) => {
  // updateMany с userId — пользователь не может трогать чужие уведомления
  await db.notification.updateMany({ where: { id: d.id, userId: user.id }, data: { readAt: new Date() } });
  return { ok: true };
});
