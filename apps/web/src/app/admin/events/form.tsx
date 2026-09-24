"use client";

import { EVENT_TYPE_LABELS, toMoscowInputValue } from "@drago/shared";
import { AudienceSelect, UserMultiSelect } from "@/components/admin/pickers";
import { ActionForm, Checkbox, Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { saveEvent } from "./actions";

type Ev = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  location: string | null;
  isPublic: boolean;
  minRoleLevel: number;
  capacity: number | null;
  requiresConfirmation: boolean;
  organizerId: string | null;
};

export function EventForm({ event, users, participantIds = [] }: { event?: Ev; users: { id: string; name: string; role: string }[]; participantIds?: string[] }) {
  return (
    <ActionForm action={saveEvent} refreshOnSuccess className="grid gap-5">
      {event && <input type="hidden" name="id" value={event.id} />}
      <FormMessage />
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <Field label="Название" name="title" required>
          <Input name="title" defaultValue={event?.title} maxLength={150} />
        </Field>
        <Field label="Тип" name="type">
          <Select name="type" defaultValue={event?.type ?? "EVENT"}>
            {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Описание" name="description" hint="Markdown">
        <Textarea name="description" defaultValue={event?.description ?? ""} rows={5} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Начало (МСК)" name="startsAt" required>
          <Input name="startsAt" type="datetime-local" defaultValue={toMoscowInputValue(event?.startsAt)} />
        </Field>
        <Field label="Окончание (МСК)" name="endsAt">
          <Input name="endsAt" type="datetime-local" defaultValue={toMoscowInputValue(event?.endsAt)} />
        </Field>
        <Field label="Место" name="location">
          <Input name="location" defaultValue={event?.location ?? ""} maxLength={200} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Для кого" name="minRoleLevel">
          <AudienceSelect defaultValue={event?.minRoleLevel ?? 10} />
        </Field>
        <Field label="Мест (необязательно)" name="capacity">
          <Input name="capacity" type="number" min={1} defaultValue={event?.capacity ?? ""} />
        </Field>
        <Field label="Организатор" name="organizerId">
          <Select name="organizerId" defaultValue={event?.organizerId ?? ""}>
            <option value="">—</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Checkbox name="allDay" defaultChecked={event?.allDay} label="Весь день" />
        <Checkbox name="requiresConfirmation" defaultChecked={event?.requiresConfirmation ?? true} label="Нужно подтверждение участия" />
        <Checkbox name="isPublic" defaultChecked={event?.isPublic} label="Показывать в публичном календаре на сайте" />
      </div>
      <Field label="Пригласить участников" name="participants" hint="Приглашённые получат уведомление. Можно пригласить всю аудиторию.">
        <UserMultiSelect name="participants" users={users} defaultSelected={participantIds} />
      </Field>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Checkbox name="inviteAll" label="Пригласить всю выбранную аудиторию" />
        {event && <Checkbox name="notifyUsers" label="Уведомить участников об изменениях" />}
      </div>
      <div>
        <SubmitButton>{event ? "Сохранить" : "Создать мероприятие"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
