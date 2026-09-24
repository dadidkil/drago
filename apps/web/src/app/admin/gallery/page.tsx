import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@drago/database";
import { formatDate } from "@drago/shared";
import { Badge, Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { GalleryForm } from "./forms";

export const metadata: Metadata = { title: "Галерея" };

export default async function AdminGallery() {
  await requireAdmin("gallery.manage");
  const galleries = await db.gallery.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { photos: true } }, photos: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1 } },
  });
  return (
    <>
      <PageHeader title="Галерея" description="Альбомы и фото для публичного сайта." />
      <Card className="mb-6">
        <h2 className="mb-4 font-semibold">Новый альбом</h2>
        <GalleryForm />
      </Card>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {galleries.map((g) => (
          <li key={g.id}>
            <Link href={`/admin/gallery/${g.id}`} className="block overflow-hidden rounded-2xl border border-line bg-white hover:border-fire/50">
              <div className="aspect-[16/9] bg-paper-2">
                {g.photos[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/media/${g.photos[0].fileId}`} alt="" className="size-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="p-4">
                <p className="font-semibold">{g.title}</p>
                <div className="mt-1 flex flex-wrap gap-1 text-xs">
                  <Badge tone={g.isPublished ? "success" : "neutral"}>{g.isPublished ? "опубликован" : "скрыт"}</Badge>
                  <Badge>фото: {g._count.photos}</Badge>
                  {g.eventDate && <Badge tone="air">{formatDate(g.eventDate)}</Badge>}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
