"use client";

import { ActionForm, Field, FormMessage, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { addTaskComment, updateMyTaskStatus } from "../actions";

export function StatusButtons({ taskId, current }: { taskId: string; current: string }) {
  const options = [
    { value: "NEW", label: "Новая" },
    { value: "IN_PROGRESS", label: "Взять в работу" },
    { value: "DONE", label: "Выполнена" },
  ].filter((o) => o.value !== current);
  return (
    <ActionForm action={updateMyTaskStatus} refreshOnSuccess className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="taskId" value={taskId} />
      <span className="mr-1 text-sm text-muted">Изменить статус:</span>
      {options.map((o) => (
        <SubmitButton key={o.value} name="status" value={o.value} variant={o.value === "DONE" ? "primary" : "secondary"} size="sm" pendingText="…">
          {o.label}
        </SubmitButton>
      ))}
      <FormMessage className="w-full" />
    </ActionForm>
  );
}

export function CommentForm({ taskId }: { taskId: string }) {
  return (
    <ActionForm action={addTaskComment} resetOnSuccess refreshOnSuccess className="grid gap-3 rounded-2xl border border-line bg-white p-4">
      <input type="hidden" name="taskId" value={taskId} />
      <FormMessage />
      <Field label="Новый комментарий" name="body">
        <Textarea name="body" rows={3} maxLength={2000} required />
      </Field>
      <Field label="Файлы" name="files" hint="До 5 файлов: PDF, документы, изображения; до 15 МБ каждый">
        <Input name="files[]" type="file" multiple className="py-2 text-sm" />
      </Field>
      <div>
        <SubmitButton size="sm">Отправить</SubmitButton>
      </div>
    </ActionForm>
  );
}
