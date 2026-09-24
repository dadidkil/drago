"use client";

import { PUBLISH_STATUS_LABELS, toMoscowInputValue } from "@drago/shared";
import { ActionForm, Checkbox, Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { saveNews } from "./actions";

export function NewsForm({
  item,
}: {
  item?: { id: string; title: string; slug: string; excerpt: string | null; content: string; status: string; publishedAt: Date | null; coverFileId: string | null };
}) {
  return (
    <ActionForm action={saveNews} className="grid gap-5">
      {item && <input type="hidden" name="id" value={item.id} />}
      <FormMessage />
      <Field label="Заголовок" name="title" required>
        <Input name="title" defaultValue={item?.title} maxLength={200} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Адрес (slug)" name="slug" hint="Пусто — из заголовка">
          <Input name="slug" defaultValue={item?.slug} placeholder="vyezd-v-lager" />
        </Field>
        <Field label="Статус" name="status">
          <Select name="status" defaultValue={item?.status ?? "DRAFT"}>
            {Object.entries(PUBLISH_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Дата публикации (МСК)" name="publishedAt" hint="Будущая дата — отложенная публикация">
          <Input name="publishedAt" type="datetime-local" defaultValue={toMoscowInputValue(item?.publishedAt)} />
        </Field>
      </div>
      <Field label="Анонс" name="excerpt" hint="1–2 предложения для карточки и поисковиков">
        <Textarea name="excerpt" defaultValue={item?.excerpt ?? ""} rows={2} maxLength={400} />
      </Field>
      <Field label="Текст" name="content" required hint="Markdown: ## подзаголовок, **жирный**, списки, [ссылка](https://…)">
        <Textarea name="content" defaultValue={item?.content} rows={16} className="font-mono text-sm" />
      </Field>
      <Field label="Обложка" name="cover" hint="Изображение до 15 МБ. EXIF/геометки удаляются. Публикуйте фото несовершеннолетних только с согласия.">
        <Input name="cover" type="file" accept="image/*" className="py-2 text-sm" />
      </Field>
      {item?.coverFileId && (
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/media/${item.coverFileId}`} alt="" className="h-20 w-32 rounded-lg object-cover" />
          <Checkbox name="removeCover" label="Удалить обложку" />
        </div>
      )}
      <div>
        <SubmitButton>Сохранить</SubmitButton>
      </div>
    </ActionForm>
  );
}
