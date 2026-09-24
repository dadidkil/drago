"use client";

import { ActionData, ActionForm, Checkbox, Field, FormMessage, Input, InlineAction, Select, SubmitButton } from "@/components/ui/form";
import { createUser, deleteUser, reset2fa, resendInvite, revokeSessions, sendPasswordReset, showInviteLink, updateUser } from "./actions";

type Role = { key: string; name: string };

function ProfileFields({ d }: { d?: { lastName?: string; firstName?: string; middleName?: string | null; position?: string | null; squadStatus?: string | null; joinedYear?: number | null } }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Фамилия" name="lastName" required>
          <Input name="lastName" defaultValue={d?.lastName ?? ""} />
        </Field>
        <Field label="Имя" name="firstName" required>
          <Input name="firstName" defaultValue={d?.firstName ?? ""} />
        </Field>
        <Field label="Отчество" name="middleName">
          <Input name="middleName" defaultValue={d?.middleName ?? ""} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Должность" name="position" hint="командир, комиссар, мастер…">
          <Input name="position" defaultValue={d?.position ?? ""} />
        </Field>
        <Field label="Статус в отряде" name="squadStatus" hint="кандидат, боец, ветеран…">
          <Input name="squadStatus" defaultValue={d?.squadStatus ?? ""} />
        </Field>
        <Field label="Год вступления" name="joinedYear">
          <Input name="joinedYear" type="number" min={1990} max={2100} defaultValue={d?.joinedYear ?? ""} />
        </Field>
      </div>
    </>
  );
}

export function NewUserForm({ roles }: { roles: Role[] }) {
  return (
    <ActionForm action={createUser} className="grid gap-5">
      <FormMessage />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email (логин)" name="email" required hint="Личный email бойца — на него придёт приглашение">
          <Input name="email" type="email" autoComplete="off" />
        </Field>
        <Field label="Роль" name="roleKey" required>
          <Select name="roleKey" defaultValue={roles.find((r) => r.key === "FIGHTER") ? "FIGHTER" : roles[0]?.key}>
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <ProfileFields />
      <Checkbox name="sendInvite" defaultChecked label="Отправить приглашение на email (ссылка для установки пароля, 72 часа)" />
      <div>
        <SubmitButton>Создать пользователя</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function EditUserForm({
  user,
  roles,
}: {
  user: {
    id: string;
    email: string;
    status: string;
    roleKey: string;
    profile: { lastName: string; firstName: string; middleName: string | null; position: string | null; squadStatus: string | null; joinedYear: number | null; phone: string | null } | null;
  };
  roles: Role[];
}) {
  return (
    <ActionForm action={updateUser} refreshOnSuccess className="grid gap-5">
      <input type="hidden" name="userId" value={user.id} />
      <FormMessage />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Email (логин)" name="email" required hint="При смене — сессии завершатся, потребуется подтверждение">
          <Input name="email" type="email" defaultValue={user.email} />
        </Field>
        <Field label="Роль" name="roleKey" required>
          <Select name="roleKey" defaultValue={user.roleKey}>
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Статус" name="status" required>
          <Select name="status" defaultValue={user.status}>
            {user.status === "INVITED" && <option value="INVITED">Приглашён</option>}
            <option value="ACTIVE">Активен</option>
            <option value="SUSPENDED">Заблокирован</option>
            <option value="ARCHIVED">В архиве (выбыл)</option>
          </Select>
        </Field>
      </div>
      <ProfileFields d={user.profile ?? undefined} />
      <Field label="Телефон" name="phone" hint="Только при необходимости. Виден командному составу.">
        <Input name="phone" type="tel" defaultValue={user.profile?.phone ?? ""} />
      </Field>
      <div>
        <SubmitButton>Сохранить</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function UserSecurityActions({ userId, status, has2fa }: { userId: string; status: string; has2fa: boolean }) {
  return (
    <div className="grid gap-4">
      {status === "INVITED" ? (
        <>
          <InlineAction action={resendInvite} fields={{ userId }} label="Отправить приглашение повторно" variant="secondary" refresh={false} />
          <ActionForm action={showInviteLink} className="grid gap-2">
            <input type="hidden" name="userId" value={userId} />
            <FormMessage />
            <ActionData>
              {(d) => <code className="block rounded-lg bg-paper-2 p-2 text-xs break-all select-all">{String(d.link)}</code>}
            </ActionData>
            <div>
              <SubmitButton variant="ghost" size="sm">
                Показать ссылку-приглашение
              </SubmitButton>
            </div>
          </ActionForm>
        </>
      ) : (
        <InlineAction action={sendPasswordReset} fields={{ userId }} label="Отправить ссылку сброса пароля" variant="secondary" refresh={false} confirm="Отправить пользователю письмо для сброса пароля?" />
      )}
      <InlineAction action={revokeSessions} fields={{ userId }} label="Завершить все сессии" variant="secondary" confirm="Завершить все сессии пользователя?" />
      {has2fa && <InlineAction action={reset2fa} fields={{ userId }} label="Сбросить 2FA" variant="secondary" confirm="Сбросить 2FA? Делайте это только после проверки личности." />}
    </div>
  );
}

export function DeleteUserForm({ userId, email }: { userId: string; email: string }) {
  return (
    <ActionForm action={deleteUser} className="grid gap-3" confirmMessage="Удалить пользователя безвозвратно?">
      <input type="hidden" name="userId" value={userId} />
      <FormMessage />
      <p className="text-sm text-muted">
        Удаление безвозвратно стирает аккаунт, профиль, привязки и корпоративный ящик. Для выбывших бойцов обычно достаточно статуса «В архиве».
      </p>
      <Field label={`Введите ${email} для подтверждения`} name="confirmEmail">
        <Input name="confirmEmail" autoComplete="off" />
      </Field>
      <div>
        <SubmitButton variant="danger" size="sm">
          Удалить навсегда
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
