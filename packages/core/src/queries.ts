import { db } from "@drago/database";

/** Общие запросы «что видит пользователь» — используются кабинетом и ботами. */

export function visibleAnnouncementsWhere(level: number) {
  return {
    minRoleLevel: { lte: level },
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
}

export async function announcementsForLevel(level: number, take = 10) {
  return db.announcement.findMany({
    where: visibleAnnouncementsWhere(level),
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take,
    include: { attachments: { select: { id: true, originalName: true, size: true, mimeType: true } } },
  });
}

export async function upcomingEventsForUser(user: { id: string; level: number }, take = 10) {
  const now = new Date();
  return db.event.findMany({
    where: {
      minRoleLevel: { lte: user.level },
      OR: [{ startsAt: { gte: now } }, { endsAt: { gte: now } }],
    },
    orderBy: { startsAt: "asc" },
    take,
    include: { participants: { where: { userId: user.id }, select: { status: true } } },
  });
}

export async function openTasksForUser(userId: string, take = 20) {
  return db.task.findMany({
    where: { assignees: { some: { userId } }, status: { in: ["NEW", "IN_PROGRESS"] } },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take,
  });
}

export function visibleDocumentsWhere(level: number) {
  return {
    category: { minRoleLevel: { lte: level } },
    OR: [{ minRoleLevel: null }, { minRoleLevel: { lte: level } }],
  };
}

export async function documentsForLevel(level: number, take = 50) {
  return db.document.findMany({
    where: visibleDocumentsWhere(level),
    orderBy: { createdAt: "desc" },
    take,
    include: { category: { select: { name: true } }, file: { select: { size: true, mimeType: true } } },
  });
}

export async function publicUpcomingEvents(take = 6) {
  const now = new Date();
  return db.event.findMany({
    where: { isPublic: true, status: "SCHEDULED", OR: [{ startsAt: { gte: now } }, { endsAt: { gte: now } }] },
    orderBy: { startsAt: "asc" },
    take,
    select: { id: true, title: true, description: true, type: true, startsAt: true, endsAt: true, allDay: true, location: true },
  });
}

/** Пользователь с уровнем роли — для ботов (по привязанному аккаунту). */
export async function userWithLevel(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      status: true,
      role: { select: { key: true, name: true, level: true } },
      profile: { select: { firstName: true, lastName: true, position: true, squadStatus: true, joinedYear: true } },
      emailAccount: { select: { address: true, status: true } },
    },
  });
  if (!user || user.status !== "ACTIVE") return null;
  return { ...user, level: user.role.level };
}
