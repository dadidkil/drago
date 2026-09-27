import type { Metadata } from "next";
import Image from "next/image";
import { getSetting } from "@drago/core";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { mediaUrl } from "@/lib/uploads";
import { SitePhotoForm, UploadSitePhotosForm } from "./forms";

export const metadata: Metadata = { title: "Фото сайта" };

export default async function SiteMediaPage() {
  await requireAdmin("pages.manage");
  const media = await getSetting("site.media");
  return (
    <>
      <PageHeader
        title="Фото сайта"
        description="Фон главного экрана, полоса фото на странице «О нас» и блок «Жизнь отряда» на главной (если в галерее ещё нет опубликованных альбомов). Логотип встроен в сайт."
      />
      <Card className="mb-6 max-w-2xl">
        <h2 className="mb-3 font-semibold">Загрузить</h2>
        <UploadSitePhotosForm />
      </Card>
      {media.photos.length === 0 ? (
        <EmptyState title="Фото пока нет">Загрузите 3–6 ярких фото отряда: первое станет фоном главного экрана.</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {media.photos.map((p, i) => (
            <li key={p.fileId} className="overflow-hidden rounded-2xl border border-line bg-white">
              <div className="relative aspect-[3/2] bg-paper-2">
                <Image src={mediaUrl(p.fileId)!} alt={p.alt} fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover" />
                {media.heroFileId === p.fileId && (
                  <Badge tone="fire" className="absolute top-3 left-3">
                    фон главного экрана
                  </Badge>
                )}
              </div>
              <div className="p-4">
                <SitePhotoForm photo={p} isHero={media.heroFileId === p.fileId} first={i === 0} last={i === media.photos.length - 1} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
