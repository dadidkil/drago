"use client";

import { toMoscowInputValue } from "@drago/shared";
import { UserMultiSelect } from "@/components/admin/pickers";
import { ActionForm, Checkbox, Field, FormMessage, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { saveTask } from "./actions";

export function TaskForm({
  task,
  users,
}: {
  task?: { id: string; title: string; description: string | null; status: string; dueAt: Date | null; assigneeIds: string[] };
  users: { id: string; name: string; role: string }[];
}) {
  return (
    <ActionForm action={saveTask} className="grid gap-5">
      {task && <input type="hidden" name="id" value={task.id} />}
      <FormMessage />
      <Field label="Название" name="title" required>
        <Input name="title" defaultValue={task?.title} maxLength={200} />
      </Field>
      <Field label="Описание" name="description" hint="Markdown">
        <Textarea name="description" defaultValue={task?.description ?? ""} rows={6} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Дедлайн (МСК)" name="dueAt">
          <Input name="dueAt" type="datetime-local" defaultValue={toMoscowInputValue(task?.dueAt)} />
        </Field>
        <div className="self-end pb-2">
          <Checkbox name="cancelled" defaultChecked={task?.status === "CANCELLED"} label="Задача отменена" />
        </div>
      </div>
      <Field label="Исполнители" name="assignees" required hint="Новым исполнителям придёт уведомление в кабинет и Telegram с кнопками «В работу» и «Сдать». Сдачу проверяете вы.">
        <UserMultiSelect name="assignees" users={users} defaultSelected={task?.assigneeIds} />
      </Field>
      <Field label="Вложения" name="files">
        <Input name="files[]" type="file" multiple className="py-2 text-sm" />
      </Field>
      <div>
        <SubmitButton>{task ? "Сохранить" : "Поставить задачу"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
