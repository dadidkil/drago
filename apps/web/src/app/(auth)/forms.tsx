"use client";

import Link from "next/link";
import { ActionForm, Field, FormMessage, Input, SubmitButton, useFormCtx } from "@/components/ui/form";
import { acceptInvite, confirmEmail, login, requestPasswordReset, resetPassword, verifySecondFactor } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={login} className="grid gap-5">
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage />
      <Field label="Email" name="email" required>
        <Input name="email" type="email" autoComplete="username" required autoFocus inputMode="email" />
      </Field>
      <Field label="Пароль" name="password" required>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="flex items-center justify-between gap-4">
        <SubmitButton size="lg" pendingText="Входим…">
          Войти
        </SubmitButton>
        <Link href="/auth/forgot" className="text-sm font-medium text-fire hover:underline">
          Забыли пароль?
        </Link>
      </div>
    </ActionForm>
  );
}

export function TwoFactorForm({ next }: { next?: string }) {
  return (
    <ActionForm action={verifySecondFactor} className="grid gap-5">
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage />
      <Field label="Код из приложения" name="code" required hint="6 цифр из Google Authenticator, Яндекс Ключа и т. п. или резервный код">
        <Input name="code" autoComplete="one-time-code" inputMode="text" required autoFocus maxLength={12} className="font-mono text-lg tracking-[0.3em]" />
      </Field>
      <SubmitButton size="lg" pendingText="Проверяем…">
        Подтвердить
      </SubmitButton>
    </ActionForm>
  );
}

function ForgotInner() {
  const { state } = useFormCtx();
  if (state.ok) return <FormMessage />;
  return (
    <>
      <FormMessage />
      <Field label="Email" name="email" required>
        <Input name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <SubmitButton size="lg" pendingText="Отправляем…">
        Отправить ссылку
      </SubmitButton>
    </>
  );
}

export function ForgotForm() {
  return (
    <ActionForm action={requestPasswordReset} className="grid gap-5">
      <ForgotInner />
    </ActionForm>
  );
}

export function NewPasswordForm({ token, mode }: { token: string; mode: "reset" | "invite" }) {
  return (
    <ActionForm action={mode === "reset" ? resetPassword : acceptInvite} className="grid gap-5">
      <input type="hidden" name="token" value={token} />
      <FormMessage />
      <Field label="Новый пароль" name="password" required hint="Не короче 10 символов, буквы и цифры. Лучше — фраза из нескольких слов.">
        <Input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} autoFocus />
      </Field>
      <Field label="Повторите пароль" name="confirm" required>
        <Input name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton size="lg" pendingText="Сохраняем…">
        {mode === "reset" ? "Сменить пароль" : "Задать пароль и войти"}
      </SubmitButton>
    </ActionForm>
  );
}

function ConfirmInner() {
  const { state } = useFormCtx();
  if (state.ok)
    return (
      <>
        <FormMessage />
        <Link href="/cabinet" className="font-semibold text-fire">
          Перейти в кабинет →
        </Link>
      </>
    );
  return (
    <>
      <FormMessage />
      <SubmitButton size="lg">Подтвердить email</SubmitButton>
    </>
  );
}

export function ConfirmEmailForm({ token }: { token: string }) {
  return (
    <ActionForm action={confirmEmail} className="grid gap-5">
      <input type="hidden" name="token" value={token} />
      <ConfirmInner />
    </ActionForm>
  );
}
