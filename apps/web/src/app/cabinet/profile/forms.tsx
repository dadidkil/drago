"use client";

import { ActionForm, Checkbox, Field, FormMessage, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { updateNotificationPrefs, updateProfile } from "./actions";

export function ProfileForm({
  profile,
}: {
  profile: { lastName: string; firstName: string; middleName: string | null; phone: string | null; bio: string | null; hasAvatar: boolean };
}) {
  return (
    <ActionForm action={updateProfile} refreshOnSuccess className="grid gap-5">
      <FormMessage />
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Фамилия" name="lastName" required>
          <Input name="lastName" defaultValue={profile.lastName} autoComplete="family-name" />
        </Field>
        <Field label="Имя" name="firstName" required>
          <Input name="firstName" defaultValue={profile.firstName} autoComplete="given-name" />
        </Field>
        <Field label="Отчество" name="middleName">
          <Input name="middleName" defaultValue={profile.middleName ?? ""} autoComplete="additional-name" />
        </Field>
      </div>
      <Field label="Телефон" name="phone" hint="Необязательно. Виден только командному составу.">
        <Input name="phone" type="tel" defaultValue={profile.phone ?? ""} autoComplete="tel" />
      </Field>
      <Field label="О себе" name="bio" hint="Пара слов для отряда — до 500 символов">
        <Textarea name="bio" defaultValue={profile.bio ?? ""} maxLength={500} rows={3} />
      </Field>
      <Field label="Фото профиля" name="avatar" hint="JPEG, PNG или WebP до 15 МБ. Метаданные (геолокация и пр.) удаляются автоматически. Фото видят только участники отряда.">
        <Input name="avatar" type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="py-2 text-sm" />
      </Field>
      {profile.hasAvatar && <Checkbox name="removeAvatar" label="Удалить текущее фото" />}
      <div>
        <SubmitButton>Сохранить профиль</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function NotificationPrefsForm({
  rows,
  channels,
}: {
  rows: { type: string; label: string; values: Record<string, boolean> }[];
  channels: { key: string; label: string; available: boolean }[];
}) {
  return (
    <ActionForm action={updateNotificationPrefs} className="grid gap-4">
      <FormMessage />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-2 pr-4 font-medium">Событие</th>
              {channels.map((c) => (
                <th key={c.key} className="px-2 py-2 text-center font-medium">
                  {c.label}
                  {!c.available && <span className="block text-[0.7rem] font-normal">не подключено</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.type}>
                <td className="py-2.5 pr-4">{r.label}</td>
                {channels.map((c) => (
                  <td key={c.key} className="px-2 py-2.5 text-center">
                    <input
                      type="checkbox"
                      name={`${r.type}:${c.key}`}
                      defaultChecked={r.values[c.key]}
                      aria-label={`${r.label}: ${c.label}`}
                      className="size-5 accent-fire"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Уведомления в кабинете приходят всегда. Внешний канал работает, только если он подключён.</p>
      <div>
        <SubmitButton variant="secondary">Сохранить настройки</SubmitButton>
      </div>
    </ActionForm>
  );
}
