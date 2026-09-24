import type { MetadataRoute } from "next";
import { db } from "@drago/database";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [news, projects, galleries] = await Promise.all([
    db.news.findMany({ where: { status: "PUBLISHED", publishedAt: { lte: new Date() } }, select: { slug: true, updatedAt: true } }),
    db.project.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    db.gallery.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
  ]);
  const staticPages = ["/", "/about", "/team", "/projects", "/news", "/gallery", "/events", "/join", "/contacts", "/privacy"];
  return [
    ...staticPages.map((p) => ({ url: absoluteUrl(p), changeFrequency: "weekly" as const, priority: p === "/" ? 1 : 0.7 })),
    ...news.map((n) => ({ url: absoluteUrl(`/news/${n.slug}`), lastModified: n.updatedAt, priority: 0.6 })),
    ...projects.map((p) => ({ url: absoluteUrl(`/projects/${p.slug}`), lastModified: p.updatedAt, priority: 0.6 })),
    ...galleries.map((g) => ({ url: absoluteUrl(`/gallery/${g.slug}`), lastModified: g.updatedAt, priority: 0.4 })),
  ];
}
