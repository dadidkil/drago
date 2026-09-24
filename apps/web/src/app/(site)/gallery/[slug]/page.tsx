import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatDate } from "@drago/shared";
import { EmptyState } from "@/components/ui/misc";
import { PhotoGrid } from "@/components/site/cards";
import { Container, PageHero } from "@/components/site/section";
import { getGallery } from "@/lib/content";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = await getGallery((await params).slug);
  if (!g) return {};
  return {
    title: g.title,
    description: g.description ?? `Фотоальбом ТОП «Драго»: ${g.title}`,
    alternates: { canonical: `/gallery/${g.slug}` },
    openGraph: g.photos[0] ? { images: [{ url: `/media/${g.photos[0].fileId}` }] } : undefined,
  };
}

export default async function GalleryAlbumPage({ params }: Props) {
  const g = await getGallery((await params).slug);
  if (!g) notFound();
  return (
    <>
      <PageHero eyebrow={g.eventDate ? formatDate(g.eventDate) : "Альбом"} title={g.title} lead={g.description} />
      <Container className="py-14 sm:py-20">
        {g.photos.length === 0 ? <EmptyState title="В альбоме пока нет фото" /> : <PhotoGrid photos={g.photos} />}
        <Link href="/gallery" className="mt-12 inline-flex items-center gap-2 font-semibold text-fire">
          <ArrowLeft className="size-4" aria-hidden /> Все альбомы
        </Link>
      </Container>
    </>
  );
}
