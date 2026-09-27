"use client";

import { ActionForm, Checkbox, FormMessage, InlineAction, Input, SubmitButton } from "@/components/ui/form";
import { deleteSitePhoto, updateSitePhoto, uploadSitePhotos } from "./actions";

export function UploadSitePhotosForm() {
  return (
    <ActionForm action={uploadSitePhotos} resetOnSuccess refreshOnSuccess className="grid gap-3">
      <FormMessage />
      <Input name="photos[]" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="py-2 text-sm" />
      <p className="text-xs text-muted">
        JPEG, PNG, WebP до 15 МБ, до 12 фото. Фото перекодируются, метаданные (в том числе геолокация) удаляются. На сайте они публичные — на
        фотографиях подростков нужны согласия родителей.
      </p>
      <div>
        <SubmitButton pendingText="Загружаем…">Загрузить</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function SitePhotoForm({ photo, isHero, first, last }: { photo: { fileId: string; alt: string }; isHero: boolean; first: boolean; last: boolean }) {
  return (
    <div className="grid gap-2">
      <ActionForm action={updateSitePhoto} refreshOnSuccess className="grid gap-2">
        <input type="hidden" name="fileId" value={photo.fileId} />
        <Input name="alt" defaultValue={photo.alt} maxLength={200} placeholder="Что на фото (для незрячих и поисковиков)" className="text-sm" aria-label="Описание фото" />
        <Checkbox name="hero" defaultChecked={isHero} label="Фон главного экрана" />
        <div className="flex flex-wrap gap-2">
          <SubmitButton size="sm" variant="secondary">
            Сохранить
          </SubmitButton>
          {!first && (
            <SubmitButton size="sm" variant="ghost" name="move" value="up">
              ← Раньше
            </SubmitButton>
          )}
          {!last && (
            <SubmitButton size="sm" variant="ghost" name="move" value="down">
              Позже →
            </SubmitButton>
          )}
        </div>
        <FormMessage />
      </ActionForm>
      <InlineAction action={deleteSitePhoto} fields={{ fileId: photo.fileId }} label="Удалить" variant="danger" confirm="Удалить фото с сайта?" />
    </div>
  );
}
