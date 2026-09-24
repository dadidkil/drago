"use client";

import { ActionData, ActionForm, Field, FormMessage, Input, SubmitButton, useFormCtx } from "@/components/ui/form";
import {
  changePassword,
  confirmTotpSetup,
  disableTotp,
  regenerateRecoveryCodes,
  startTelegramLink,
  startTotpSetup,
  startVkLink,
} from "./actions";

export function ChangePasswordForm() {
  return (
    <ActionForm action={changePassword} resetOnSuccess className="grid gap-4">
      <FormMessage />
      <Field label="Текущий пароль" name="currentPassword" required>
        <Input name="currentPassword" type="password" autoComplete="current-password" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Новый пароль" name="password" required hint="От 10 символов, буквы и цифры">
          <Input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} />
        </Field>
        <Field label="Повторите" name="confirm" required>
          <Input name="confirm" type="password" autoComplete="new-password" />
        </Field>
      </div>
      <div>
        <SubmitButton variant="secondary">Сменить пароль</SubmitButton>
      </div>
    </ActionForm>
  );
}

function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-warning/50 bg-[#fdf3e0] p-4">
      <p className="font-semibold">Резервные коды — сохраните их сейчас</p>
      <p className="mt-1 text-sm text-ink-2">Каждый код одноразовый. Пригодится, если потеряете телефон. Больше они не покажутся.</p>
      <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-4">
        {codes.map((c) => (
          <li key={c} className="rounded-md bg-white px-2 py-1 text-center select-all">
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StartTotpForm() {
  return (
    <ActionForm action={startTotpSetup} refreshOnSuccess>
      <FormMessage />
      <SubmitButton>Включить двухфакторную защиту</SubmitButton>
    </ActionForm>
  );
}

function ConfirmInner() {
  const { state } = useFormCtx();
  return (
    <>
      <FormMessage />
      <ActionData>{(d) => <RecoveryCodes codes={d.recoveryCodes as string[]} />}</ActionData>
      {!state.ok && (
        <>
          <Field label="Код из приложения" name="code" required>
            <Input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="max-w-40 font-mono text-lg tracking-[0.3em]" />
          </Field>
          <div>
            <SubmitButton>Подтвердить</SubmitButton>
          </div>
        </>
      )}
    </>
  );
}

export function ConfirmTotpForm() {
  return (
    <ActionForm action={confirmTotpSetup} className="grid gap-4">
      <ConfirmInner />
    </ActionForm>
  );
}

export function RegenerateCodesForm() {
  return (
    <ActionForm action={regenerateRecoveryCodes} className="grid gap-3">
      <FormMessage />
      <ActionData>{(d) => <RecoveryCodes codes={d.recoveryCodes as string[]} />}</ActionData>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Код из приложения" name="code">
          <Input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="max-w-40 font-mono" />
        </Field>
        <SubmitButton variant="secondary">Новые резервные коды</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DisableTotpForm() {
  return (
    <ActionForm action={disableTotp} refreshOnSuccess className="grid gap-3">
      <FormMessage />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Текущий пароль" name="currentPassword">
          <Input name="currentPassword" type="password" autoComplete="current-password" />
        </Field>
        <Field label="Код или резервный код" name="code">
          <Input name="code" autoComplete="one-time-code" maxLength={12} className="font-mono" />
        </Field>
      </div>
      <div>
        <SubmitButton variant="danger" size="sm">
          Отключить 2FA
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function TelegramLinkForm() {
  return (
    <ActionForm action={startTelegramLink} className="grid gap-3">
      <FormMessage />
      <ActionData>
        {(d) => (
          <div className="rounded-xl bg-[#e3f0fb] p-4 text-sm">
            <p>Ссылка действует 10 минут и срабатывает один раз:</p>
            <a href={String(d.url)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-water underline">
              Открыть бота в Telegram и нажать «Start»
            </a>
          </div>
        )}
      </ActionData>
      <div>
        <SubmitButton variant="secondary" size="sm">
          Подключить Telegram
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function VkLinkForm() {
  return (
    <ActionForm action={startVkLink} className="grid gap-3">
      <FormMessage />
      <ActionData>
        {(d) => (
          <div className="rounded-xl bg-[#e3f0fb] p-4 text-sm">
            <p>
              Напишите в сообщения сообщества ВКонтакте (код действует 10 минут):
            </p>
            <p className="mt-2 font-mono text-lg font-semibold select-all">привязать {String(d.code)}</p>
            {d.url ? (
              <a href={String(d.url)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-water underline">
                Открыть сообщения сообщества
              </a>
            ) : null}
          </div>
        )}
      </ActionData>
      <div>
        <SubmitButton variant="secondary" size="sm">
          Подключить ВКонтакте
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
