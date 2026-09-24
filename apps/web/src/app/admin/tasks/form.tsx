"use client";

import { TASK_STATUS_LABELS, toMoscowInputValue } from "@drago/shared";
import { UserMultiSelect } from "@/components/admin/pickers";
import { ActionForm, Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
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
        <Field label="Статус" name="status">
          <Select name="status" defaultValue={task?.status ?? "NEW"}>
            {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Исполнители" name="assignees" required hint="Новым исполнителям придёт уведомление">
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
