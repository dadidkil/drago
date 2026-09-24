"use client";

import { APPLICATION_STATUS_LABELS } from "@drago/shared";
import { ActionForm, Field, FormMessage, Input, InlineAction, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { createAccountFromApplication, deleteApplication, updateApplication } from "./actions";

export function ApplicationStatusForm({ id, status, notes }: { id: string; status: string; notes: string | null }) {
  return (
    <ActionForm action={updateApplication} refreshOnSuccess className="grid gap-4">
      <input type="hidden" name="id" value={id} />
      <FormMessage />
      <Field label="Статус" name="status">
        <Select name="status" defaultValue={status}>
          {Object.entries(APPLICATION_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Заметки командного состава" name="notes" hint="Видны только в админ-панели. Не пишите лишних персональных данных.">
        <Textarea name="notes" defaultValue={notes ?? ""} rows={5} maxLength={4000} />
      </Field>
      <div>
        <SubmitButton>Сохранить</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function CreateAccountForm({ id, email, lastName, firstName }: { id: string; email: string; lastName: string; firstName: string }) {
  return (
    <ActionForm action={createAccountFromApplication} className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <FormMessage />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Фамилия" name="lastName">
          <Input name="lastName" defaultValue={lastName} />
        </Field>
        <Field label="Имя" name="firstName">
          <Input name="firstName" defaultValue={firstName} />
        </Field>
      </div>
      <Field label="Email для входа" name="email" hint="На него придёт приглашение">
        <Input name="email" type="email" defaultValue={email} />
      </Field>
      <Field label="Роль" name="roleKey">
        <Select name="roleKey" defaultValue="CANDIDATE">
          <option value="CANDIDATE">Кандидат</option>
          <option value="FIGHTER">Боец</option>
        </Select>
      </Field>
      <div>
        <SubmitButton variant="secondary">Создать аккаунт и пригласить</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DeleteApplication({ id }: { id: string }) {
  return <InlineAction action={deleteApplication} fields={{ id }} label="Удалить заявку" variant="danger" confirm="Удалить заявку и все её данные безвозвратно?" />;
}
