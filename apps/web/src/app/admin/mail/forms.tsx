"use client";

import { useState } from "react";
import { ActionForm, Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import { createMailbox } from "./actions";

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
