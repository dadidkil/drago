import "server-only";
import { cache } from "react";
import { db } from "@drago/database";
import { getSettings, publicUpcomingEvents } from "@drago/core";

/**
 * Публичные данные сайта. Только опубликованный контент и только поля,
 * безопасные для публикации (никаких email/телефонов бойцов, внутренних пользователей).
 */

export const getSiteSettings = cache(() => getSettings(["site.general", "site.contacts", "integrations"]));

export const getPublishedPage = cache((slug: string) => db.page.findFirst({ where: { slug, isPublished: true } }));

export const getTeam = cache(() =>
  db.teamMember.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, fullName: true, position: true, bio: true, photoFileId: true },
  }),
);

export const getProjects = cache(() =>
  db.project.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, slug: true, title: true, summary: true, partner: true, period: true, coverFileId: true },
  }),
);

export const getProject = cache((slug: string) => db.project.findFirst({ where: { slug, isPublished: true } }));

export const getAchievements = cache(() =>
  db.achievement.findMany({
    where: { isPublished: true },
    orderBy: [{ year: { sort: "desc", nulls: "last" } }, { sortOrder: "asc" }],
  }),
);

export const getFaq = cache(() =>
  db.faqItem.findMany({ where: { isPublished: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
);

export const getGalleries = cache(() =>
  db.gallery.findMany({
    where: { isPublished: true, photos: { some: {} } },
    orderBy: [{ sortOrder: "asc" }, { eventDate: { sort: "desc", nulls: "last" } }],
    include: {
      _count: { select: { photos: true } },
      photos: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1, select: { fileId: true, caption: true } },
    },
  }),
);

export const getGallery = cache((slug: string) =>
  db.gallery.findFirst({
    where: { slug, isPublished: true },
    include: {
      photos: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, fileId: true, caption: true, file: { select: { width: true, height: true } } },
      },
    },
  }),
);

export const getLatestPhotos = cache((take = 8) =>
  db.photo.findMany({
    where: { gallery: { isPublished: true } },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, fileId: true, caption: true, gallery: { select: { slug: true, title: true } } },
  }),
);

const NEWS_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverFileId: true,
  publishedAt: true,
} as const;

export const getLatestNews = cache((take = 3) =>
  db.news.findMany({
    where: { status: "PUBLISHED", publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: "desc" },
    take,
    select: NEWS_SELECT,
  }),
);

export const NEWS_PAGE_SIZE = 9;

export const getNewsPage = cache(async (page: number) => {
  const where = { status: "PUBLISHED" as const, publishedAt: { lte: new Date() } };
  const [items, total] = await Promise.all([
    db.news.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * NEWS_PAGE_SIZE,
      take: NEWS_PAGE_SIZE,
      select: NEWS_SELECT,
    }),
    db.news.count({ where }),
  ]);
  return { items, total, pages: Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE)) };
});

export const getNewsItem = cache((slug: string) =>
  db.news.findFirst({ where: { slug, status: "PUBLISHED", publishedAt: { lte: new Date() } } }),
);

export const getPublicEvents = cache((take = 6) => publicUpcomingEvents(take));
