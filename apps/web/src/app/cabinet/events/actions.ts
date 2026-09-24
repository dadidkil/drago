"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@drago/database";
import { userAction, UserError, zf } from "@/lib/actions";

export const respondToEvent = userAction(
  { schema: z.object({ eventId: zf.id(), status: z.enum(["GOING", "MAYBE", "NOT_GOING"]) }) },
  async (d, { user }) => {
    const event = await db.event.findUnique({
      where: { id: d.eventId },
      include: { _count: { select: { participants: { where: { status: "GOING" } } } } },
    });
    if (!event || event.minRoleLevel > user.level) throw new UserError("Мероприятие не найдено");
    if (event.status === "CANCELLED") throw new UserError("Мероприятие отменено");
    if (event.startsAt.getTime() < Date.now() - 3600_000) throw new UserError("Мероприятие уже прошло");
    if (d.status === "GOING" && event.capacity) {
      const mine = await db.eventParticipant.findUnique({ where: { eventId_userId: { eventId: event.id, userId: user.id } } });
      if (mine?.status !== "GOING" && event._count.participants >= event.capacity) throw new UserError("Мест больше нет");
    }
    await db.eventParticipant.upsert({
      where: { eventId_userId: { eventId: event.id, userId: user.id } },
      create: { eventId: event.id, userId: user.id, status: d.status, respondedAt: new Date() },
      update: { status: d.status, respondedAt: new Date() },
    });
    revalidatePath(`/cabinet/events/${event.id}`);
    return { ok: true, message: d.status === "GOING" ? "Отлично, ждём тебя!" : "Ответ сохранён" };
  },
);
