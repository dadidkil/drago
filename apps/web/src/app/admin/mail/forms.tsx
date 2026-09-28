"use client";

import { useState } from "react";
import { ActionForm, Checkbox, Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import { createMailbox, createMailboxesBulk, transferMailbox } from "./actions";

export function CreateMailboxForm({ users, domain, preselect }: { users: { id: string; name: string; suggestion: string }[]; domain: string; preselect?: string }) {
  const initial = users.find((u) => u.id === preselect) ?? users[0];
  const [local, setLocal] = useState(initial?.suggestion ?? "");
  if (users.length === 0) return <p className="text-sm text-muted">Все активные пользователи уже имеют ящики.</p>;
  return (
    <ActionForm action={createMailbox} refreshOnSuccess className="grid gap-4">
      <FormMessage />
      <Field label="Пользователь" name="userId" required>
        <Select
          name="userId"
          defaultValue={initial?.id}
          onChange={(e) => setLocal(users.find((u) => u.id === e.target.value)?.suggestion ?? "")}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <Field label="Адрес" name="localPart" required hint="латиница, точка, дефис">
          <div className="flex items-center gap-2">
            <Input name="localPart" value={local} onChange={(e) => setLocal(e.target.value)} autoComplete="off" />
            <span className="shrink-0 text-sm text-muted">@{domain}</span>
          </div>
        </Field>
        <Field label="Квота, МБ" name="quotaMb" hint="пусто — без лимита">
          <Input name="quotaMb" type="number" min={50} placeholder="2048" />
        </Field>
      </div>
      <div>
        <SubmitButton>Создать ящик</SubmitButton>
      </div>
    </ActionForm>
  );
}

/**
 * Пакетная выдача: отмечаем людей, адреса собираются из ФИО транслитом.
 * Одна ошибка не отменяет остальных — итог приходит построчно.
 */
export function BulkMailboxForm({ users, domain }: { users: { id: string; name: string; suggestion: string }[]; domain: string }) {
  const [picked, setPicked] = useState<string[]>([]);
  if (users.length === 0) return null;
  const toggle = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  return (
    <ActionForm action={createMailboxesBulk} refreshOnSuccess className="grid gap-4">
      <FormMessage />
      <div className="max-h-64 overflow-y-auto rounded-lg border border-line p-3">
        <ul className="grid gap-2">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3">
              <Checkbox
                name="userIds[]"
                value={u.id}
                checked={picked.includes(u.id)}
                onChange={() => toggle(u.id)}
                label={
                  <span>
                    {u.name} <span className="text-muted">— {u.suggestion || "нет ФИО"}@{domain}</span>
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr] sm:items-end">
        <Field label="Квота, МБ" name="quotaMb" hint="пусто — без лимита">
          <Input name="quotaMb" type="number" min={50} placeholder="2048" />
        </Field>
        <div>
          <SubmitButton disabled={picked.length === 0}>Создать {picked.length > 0 ? `${picked.length} ящ.` : "ящики"}</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}

/** Передача ящика другому человеку: адрес сохраняется, пароль перевыпускается. */
export function TransferMailboxForm({ id, address, users }: { id: string; address: string; users: { id: string; name: string }[] }) {
  if (users.length === 0) return <span className="text-xs text-muted">некому передать</span>;
  return (
    <ActionForm action={transferMailbox} refreshOnSuccess className="flex items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <Field label={`Передать ${address}`} name="toUserId">
        <Select name="toUserId" defaultValue={users[0]?.id}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton variant="secondary" size="sm">
        Передать
      </SubmitButton>
    </ActionForm>
  );
}
