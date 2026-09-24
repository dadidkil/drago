"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@drago/database";
import { audit, notify } from "@drago/core";
import { formatDateTime } from "@drago/shared";
import { userAction, UserError, zf } from "@/lib/actions";

const schema = z
  .object({
    id: zf.id().optional(),
    title: zf.str(3, 150, "Укажите название"),
    description: zf.optStr(10000),
    type: z.enum(["EVENT", "MEETING", "TRIP", "WORK", "DEADLINE", "OTHER"]),
    startsAt: zf.dateMsk("Укажите дату начала"),
    endsAt: zf.optDateMsk(),
    allDay: zf.bool(),
    location: zf.optStr(200),
    isPublic: zf.bool(),
    minRoleLevel: zf.int(10, 100),
    capacity: zf.optInt(1, 10000),
    requiresConfirmation: zf.bool(),
    organizerId: z.preprocess((v) => (v === "" ? undefined : v), zf.id().optional()),
    inviteAll: zf.bool(),
    participants: zf.ids(),
    notifyUsers: zf.bool(),
  })
  .refine((d) => !d.endsAt || d.endsAt >= d.startsAt, { message: "Окончание раньше начала", path: ["endsAt"] });

export const saveEvent = userAction({ permission: "events.manage", schema }, async (d, { user, ip }) => {
  const data = {
    title: d.title,
    description: d.description ?? null,
    type: d.type,
    startsAt: d.startsAt,
    endsAt: d.endsAt ?? null,
    allDay: d.allDay,
    location: d.location ?? null,
    isPublic: d.isPublic,
    minRoleLevel: d.minRoleLevel,
    capacity: d.capacity ?? null,
    requiresConfirmation: d.requiresConfirmation,
    organizerId: d.organizerId ?? null,
  };

  // Приглашённые: выбранные вручную + (опционально) вся аудитория.
  let invitees = d.participants;
  if (d.inviteAll) {
    const audience = await db.user.findMany({ where: { status: "ACTIVE", role: { level: { gte: d.minRoleLevel } } }, select: { id: true } });
    invitees = [...new Set([...invitees, ...audience.map((u) => u.id)])];
  }
  const validInvitees = (await db.user.findMany({ where: { id: { in: invitees }, status: "ACTIVE" }, select: { id: true } })).map((u) => u.id);

  if (!d.id) {
    const event = await db.event.create({
      data: { ...data, createdById: user.id, participants: { create: validInvitees.map((userId) => ({ userId })) } },
    });
    await audit({ actorId: user.id, action: "event.create", entity: "Event", entityId: event.id, ipAddress: ip });
    const recipients = validInvitees.length > 0 ? validInvitees : (await db.user.findMany({ where: { status: "ACTIVE", role: { level: { gte: d.minRoleLevel } } }, select: { id: true } })).map((u) => u.id);
    await notify({
      userIds: recipients,
      excludeUserId: user.id,
      type: "EVENT_CREATED",
      title: `Новое мероприятие: ${d.title}`,
      body: `${formatDateTime(d.startsAt)}${d.location ? `, ${d.location}` : ""}`,
      url: `/cabinet/events/${event.id}`,
    });
    redirect(`/admin/events/${event.id}?saved=1`);
  }

  const before = await db.event.findUnique({ where: { id: d.id } });
  if (!before) throw new UserError("Мероприятие не найдено");
  const timeChanged = before.startsAt.getTime() !== d.startsAt.getTime() || (before.endsAt?.getTime() ?? 0) !== (d.endsAt?.getTime() ?? 0);
  const placeChanged = (before.location ?? "") !== (d.location ?? "");
  await db.event.update({ where: { id: d.id }, data: { ...data, ...(timeChanged ? { reminderSentAt: null } : {}) } });
  if (validInvitees.length > 0) {
    await db.eventParticipant.createMany({ data: validInvitees.map((userId) => ({ eventId: d.id!, userId })), skipDuplicates: true });
  }
  await audit({ actorId: user.id, action: "event.update", entity: "Event", entityId: d.id, ipAddress: ip, metadata: { timeChanged, placeChanged } });

  if (timeChanged || placeChanged || d.notifyUsers) {
    const participants = await db.eventParticipant.findMany({ where: { eventId: d.id, status: { not: "NOT_GOING" } }, select: { userId: true } });
    const changes = [timeChanged && `время: ${formatDateTime(d.startsAt)}`, placeChanged && `место: ${d.location ?? "уточняется"}`].filter(Boolean).join("; ");
    await notify({
      userIds: participants.map((p) => p.userId),
      excludeUserId: user.id,
      type: "EVENT_UPDATED",
      title: `Изменения: ${d.title}`,
      body: changes || "Обновлена информация о мероприятии",
      url: `/cabinet/events/${d.id}`,
    });
  }
  revalidatePath(`/admin/events/${d.id}`);
  return { ok: true, message: "Сохранено" };
});

export const setEventStatus = userAction(
  { permission: "events.manage", schema: z.object({ id: zf.id(), status: z.enum(["SCHEDULED", "CANCELLED"]) }) },
  async (d, { user, ip }) => {
    const event = await db.event.update({ where: { id: d.id }, data: { status: d.status } });
    await audit({ actorId: user.id, action: d.status === "CANCELLED" ? "event.cancel" : "event.restore", entity: "Event", entityId: d.id, ipAddress: ip });
    const participants = await db.eventParticipant.findMany({ where: { eventId: d.id, status: { not: "NOT_GOING" } }, select: { userId: true } });
    await notify({
      userIds: participants.map((p) => p.userId),
      excludeUserId: user.id,
      type: "EVENT_UPDATED",
      title: d.status === "CANCELLED" ? `Отменено: ${event.title}` : `Снова в силе: ${event.title}`,
      body: formatDateTime(event.startsAt),
      url: `/cabinet/events/${d.id}`,
    });
    return { ok: true, message: d.status === "CANCELLED" ? "Мероприятие отменено, участники уведомлены" : "Мероприятие восстановлено" };
  },
);

export const markAttendance = userAction(
  { permission: "events.manage", schema: z.object({ eventId: zf.id(), userId: zf.id(), attended: zf.bool() }) },
  async (d) => {
    await db.eventParticipant.update({
      where: { eventId_userId: { eventId: d.eventId, userId: d.userId } },
      data: { status: d.attended ? "ATTENDED" : "GOING" },
    });
    return { ok: true };
  },
);

export const deleteEvent = userAction({ permission: "events.manage", schema: z.object({ id: zf.id() }) }, async (d, { user, ip }) => {
  await db.event.delete({ where: { id: d.id } });
  await audit({ actorId: user.id, action: "event.delete", entity: "Event", entityId: d.id, ipAddress: ip });
  redirect("/admin/events");
});
