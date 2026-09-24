import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@drago/database";
import { InlineAction } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { deleteGallery, deletePhoto } from "../actions";
import { GalleryForm, PhotoCaptionForm, UploadPhotosForm } from "../forms";

export const metadata: Metadata = { title: "Альбом" };

export default async function AdminAlbum({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("gallery.manage");
  const g = await db.gallery.findUnique({ where: { id: (await params).id }, include: { photos: { orderBy: { sortOrder: "asc" } } } });
  if (!g) notFound();
  return (
    <>
      <Link href="/admin/gallery" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-fire">
        <ArrowLeft className="size-4" aria-hidden /> Галерея
      </Link>
      <PageHeader
        title={g.title}
        actions={
          <>
            {g.isPublished && (
              <a href={`/gallery/${g.slug}`} target="_blank" rel="noopener" className="self-center text-sm font-semibold text-fire">
                На сайте ↗
              </a>
            )}
            <InlineAction action={deleteGallery} fields={{ id: g.id }} label="Удалить альбом" variant="danger" confirm="Удалить альбом вместе со всеми фото?" />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <GalleryForm g={g} />
        </Card>
        <Card>
          <UploadPhotosForm galleryId={g.id} />
        </Card>
      </div>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {g.photos.map((p) => (
          <li key={p.id} className="overflow-hidden rounded-2xl border border-line bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/media/${p.fileId}`} alt={p.caption ?? ""} className="aspect-square w-full object-cover" loading="lazy" />
            <div className="space-y-2 p-3">
              <PhotoCaptionForm id={p.id} caption={p.caption} isCover={p.isCover} />
              <InlineAction action={deletePhoto} fields={{ id: p.id }} label="Удалить фото" confirm="Удалить фото?" />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
