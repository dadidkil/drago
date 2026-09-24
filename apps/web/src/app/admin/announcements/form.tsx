"use client";

import { toMoscowInputValue } from "@drago/shared";
import { AudienceSelect } from "@/components/admin/pickers";
import { ActionForm, Checkbox, Field, FormMessage, Input, InlineAction, SubmitButton, Textarea } from "@/components/ui/form";
import { removeAttachment, saveAnnouncement } from "./actions";

export function AnnouncementForm({
  item,
}: {
  item?: { id: string; title: string; body: string; pinned: boolean; minRoleLevel: number; expiresAt: Date | null; attachments: { id: string; originalName: string }[] };
}) {
  return (
    <div className="grid gap-5">
      <ActionForm action={saveAnnouncement} className="grid gap-5">
        {item && <input type="hidden" name="id" value={item.id} />}
        <FormMessage />
        <Field label="Заголовок" name="title" required>
          <Input name="title" defaultValue={item?.title} maxLength={150} />
        </Field>
        <Field label="Текст" name="body" required hint="Поддерживается Markdown: **жирный**, списки, ссылки">
          <Textarea name="body" defaultValue={item?.body} rows={8} maxLength={10000} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Аудитория" name="minRoleLevel">
            <AudienceSelect defaultValue={item?.minRoleLevel ?? 20} />
          </Field>
          <Field label="Актуально до" name="expiresAt" hint="Необязательно. После — скрывается из кабинета">
            <Input name="expiresAt" type="datetime-local" defaultValue={toMoscowInputValue(item?.expiresAt)} />
          </Field>
        </div>
        <Field label="Вложения" name="files" hint="PDF, документы, изображения — до 15 МБ каждый">
          <Input name="files[]" type="file" multiple className="py-2 text-sm" />
        </Field>
        <div className="flex flex-wrap gap-5">
          <Checkbox name="pinned" defaultChecked={item?.pinned} label="Закрепить наверху" />
          {item && <Checkbox name="notifyUsers" label="Повторно уведомить аудиторию" />}
        </div>
        <div>
          <SubmitButton>{item ? "Сохранить" : "Опубликовать и уведомить"}</SubmitButton>
        </div>
      </ActionForm>
      {item && item.attachments.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Текущие вложения</p>
          <ul className="space-y-2">
            {item.attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                <a href={`/api/files/${a.id}`} className="truncate hover:text-fire">
                  {a.originalName}
                </a>
                <InlineAction action={removeAttachment} fields={{ fileId: a.id }} label="Удалить" confirm="Удалить вложение?" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
