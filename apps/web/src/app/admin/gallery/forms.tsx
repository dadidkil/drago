"use client";

import { toMoscowInputValue } from "@drago/shared";
import { ActionForm, Checkbox, Field, FormMessage, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { saveGallery, updatePhoto, uploadPhotos } from "./actions";

export function GalleryForm({ g }: { g?: { id: string; title: string; description: string | null; eventDate: Date | null; isPublished: boolean; sortOrder: number } }) {
  return (
    <ActionForm action={saveGallery} refreshOnSuccess className="grid gap-4">
      {g && <input type="hidden" name="id" value={g.id} />}
      <FormMessage />
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem_8rem]">
        <Field label="Название альбома" name="title" required>
          <Input name="title" defaultValue={g?.title} maxLength={150} />
        </Field>
        <Field label="Дата события" name="eventDate">
          <Input name="eventDate" type="datetime-local" defaultValue={toMoscowInputValue(g?.eventDate)} />
        </Field>
        <Field label="Порядок" name="sortOrder">
          <Input name="sortOrder" type="number" defaultValue={g?.sortOrder ?? 0} />
        </Field>
      </div>
      <Field label="Описание" name="description">
        <Textarea name="description" defaultValue={g?.description ?? ""} rows={2} maxLength={1000} />
      </Field>
      <Checkbox name="isPublished" defaultChecked={g?.isPublished} label="Опубликовать на сайте" />
      <div>
        <SubmitButton>{g ? "Сохранить" : "Создать альбом"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function UploadPhotosForm({ galleryId }: { galleryId: string }) {
  return (
    <ActionForm action={uploadPhotos} resetOnSuccess refreshOnSuccess className="grid gap-3">
      <input type="hidden" name="galleryId" value={galleryId} />
      <FormMessage />
      <Field label="Фотографии" name="photos" hint="До 30 файлов за раз, до 15 МБ каждый. Фото автоматически уменьшаются до 2560 px, метаданные (геолокация, модель телефона) удаляются.">
        <Input name="photos[]" type="file" accept="image/*" multiple className="py-2 text-sm" />
      </Field>
      <p className="text-xs text-warning">Публикуйте фото несовершеннолетних только при наличии согласия родителей на публикацию.</p>
      <div>
        <SubmitButton pendingText="Загружаем…">Загрузить</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function PhotoCaptionForm({ id, caption, isCover }: { id: string; caption: string | null; isCover: boolean }) {
  return (
    <ActionForm action={updatePhoto} refreshOnSuccess className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <Input name="caption" defaultValue={caption ?? ""} placeholder="Подпись" aria-label="Подпись к фото" className="py-1.5 text-sm" maxLength={300} />
      <div className="flex items-center justify-between gap-2">
        {!isCover ? <Checkbox name="makeCover" label="Обложка" className="text-xs" /> : <span className="text-xs font-semibold text-fire">Обложка</span>}
        <SubmitButton size="sm" variant="ghost" pendingText="…">
          OK
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
