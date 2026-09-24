import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { formatDate, plural } from "@drago/shared";
import { EmptyState } from "@/components/ui/misc";
import { Container, PageHero } from "@/components/site/section";
import { getGalleries } from "@/lib/content";

export const metadata: Metadata = {
  title: "Галерея",
  description: "Фотографии ТОП «Драго»: трудовые проекты, мероприятия и жизнь отряда.",
  alternates: { canonical: "/gallery" },
};

export default async function GalleryPage() {
  const galleries = await getGalleries();
  return (
    <>
      <PageHero eyebrow="Галерея" title="Жизнь отряда в кадрах" />
      <Container className="py-14 sm:py-20">
        {galleries.length === 0 ? (
          <EmptyState title="Альбомы скоро появятся" />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {galleries.map((g) => {
              const cover = g.photos[0];
              return (
                <li key={g.id}>
                  <Link href={`/gallery/${g.slug}`} className="group block overflow-hidden rounded-2xl border border-line bg-white">
                    <div className="relative aspect-[4/3] bg-paper-2">
                      {cover && (
                        <Image
                          src={`/media/${cover.fileId}`}
                          alt=""
                          fill
                          sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      )}
                    </div>
                    <div className="p-5">
                      <h2 className="text-lg font-semibold group-hover:text-fire">{g.title}</h2>
                      <p className="mt-1 text-sm text-muted">
                        {g.eventDate ? `${formatDate(g.eventDate)} · ` : ""}
                        {g._count.photos} {plural(g._count.photos, "фото", "фото", "фото")}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </>
  );
}
