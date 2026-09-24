"use client";

import { ActionForm, Checkbox, Field, FormMessage, Input, SubmitButton } from "@/components/ui/form";
import { saveMailSettings, saveRolePermissions, saveSecuritySettings } from "./actions";

export function SecurityForm({ s }: { s: { requireStaff2fa: boolean; applicationRetentionDays: number; auditRetentionDays: number } }) {
  return (
    <ActionForm action={saveSecuritySettings} className="grid gap-4">
      <FormMessage />
      <Checkbox name="requireStaff2fa" defaultChecked={s.requireStaff2fa} label="Требовать 2FA для командного состава (вход в админ-панель только с 2FA)" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Хранить заявки, дней" name="applicationRetentionDays" hint="Затем удаляются автоматически">
          <Input name="applicationRetentionDays" type="number" min={30} max={1095} defaultValue={s.applicationRetentionDays} />
        </Field>
        <Field label="Хранить журнал аудита, дней" name="auditRetentionDays">
          <Input name="auditRetentionDays" type="number" min={90} max={1825} defaultValue={s.auditRetentionDays} />
        </Field>
      </div>
      <div>
        <SubmitButton>Сохранить</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function MailSettingsForm({ s }: { s: { domain: string; webmailUrl: string; imapHost: string; smtpHost: string } }) {
  return (
    <ActionForm action={saveMailSettings} className="grid gap-4">
      <FormMessage />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Домен" name="domain">
          <Input name="domain" defaultValue={s.domain} />
        </Field>
        <Field label="Веб-почта" name="webmailUrl">
          <Input name="webmailUrl" type="url" defaultValue={s.webmailUrl} />
        </Field>
        <Field label="IMAP-сервер" name="imapHost">
          <Input name="imapHost" defaultValue={s.imapHost} />
        </Field>
        <Field label="SMTP-сервер" name="smtpHost">
          <Input name="smtpHost" defaultValue={s.smtpHost} />
        </Field>
      </div>
      <div>
        <SubmitButton>Сохранить</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function PermissionMatrix({
  roles,
  permissions,
  granted,
}: {
  roles: { key: string; name: string }[];
  permissions: { key: string; description: string }[];
  granted: Record<string, string[]>;
}) {
  return (
    <ActionForm action={saveRolePermissions} className="grid gap-4" confirmMessage="Сохранить матрицу прав?">
      <FormMessage />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted uppercase">
              <th className="py-2 pr-4 font-semibold">Право</th>
              {roles.map((r) => (
                <th key={r.key} className="px-2 py-2 text-center font-semibold">
                  {r.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {permissions.map((p) => (
              <tr key={p.key}>
                <td className="py-2 pr-4">
                  {p.description}
                  <span className="block font-mono text-xs text-muted">{p.key}</span>
                </td>
                {roles.map((r) => (
                  <td key={r.key} className="px-2 py-2 text-center">
                    <input type="checkbox" name={`${r.key}:${p.key}`} defaultChecked={granted[r.key]?.includes(p.key)} aria-label={`${r.name}: ${p.description}`} className="size-4 accent-fire" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Суперадминистратор всегда имеет все права. Кроме прав, действует иерархия: управлять можно только пользователями с ролью ниже своей.</p>
      <div>
        <SubmitButton>Сохранить матрицу</SubmitButton>
      </div>
    </ActionForm>
  );
}
