"use client";

import Link from "next/link";
import { ActionForm, Checkbox, Field, FormMessage, Input, SubmitButton, Textarea, useFormCtx } from "@/components/ui/form";
import { submitJoinApplication } from "./actions";

function SuccessOrForm() {
  const { state } = useFormCtx();
  if (state.ok) {
    return (
      <div role="status" className="rounded-2xl bg-ink p-8 text-paper">
        <p className="font-display text-2xl font-semibold">Спасибо! 🔥</p>
        <p className="mt-3 text-paper/80">{state.message}</p>
        <Link href="/" className="mt-6 inline-block font-semibold text-fire-bright underline underline-offset-4">
          Вернуться на главную
        </Link>
      </div>
    );
  }
  return (
    <div className="grid gap-5">
      <FormMessage />
      <Field label="Фамилия и имя" name="fullName" required>
        <Input name="fullName" autoComplete="name" required maxLength={120} placeholder="Иванов Иван" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Возраст" name="age" required hint="ТОП — для ребят 14–17 лет">
          <Input name="age" type="number" inputMode="numeric" min={14} max={17} required />
        </Field>
        <Field label="Телефон или email для связи" name="contact" required>
          <Input name="contact" autoComplete="tel" required maxLength={100} placeholder="+7 900 000-00-00" />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Telegram" name="telegram" hint="Необязательно">
          <Input name="telegram" maxLength={33} placeholder="@username" autoCapitalize="off" />
        </Field>
        <Field label="ВКонтакте" name="vk" hint="Необязательно">
          <Input name="vk" maxLength={100} placeholder="vk.com/username" autoCapitalize="off" />
        </Field>
      </div>
      <Field label="Школа или колледж" name="school" hint="Необязательно">
        <Input name="school" maxLength={150} placeholder="Школа № …" />
      </Field>
      <Field label="Пара слов о себе" name="comment" hint="Необязательно: почему хочешь в отряд, что умеешь, вопросы">
        <Textarea name="comment" maxLength={1000} rows={4} />
      </Field>
      {/* Honeypot: скрыт от людей и скринридеров */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Не заполняйте это поле
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-3 rounded-2xl bg-paper-2 p-4">
        <Checkbox
          name="consent"
          required
          label={
            <>
              Я согласен(на) на обработку персональных данных в соответствии с{" "}
              <Link href="/privacy" className="font-medium text-fire underline" target="_blank">
                политикой
              </Link>
            </>
          }
        />
        <Checkbox name="parentAware" required label="Мои родители (законные представители) знают, что я подаю заявку" />
      </div>
      <SubmitButton size="lg" pendingText="Отправляем…" className="w-full sm:w-auto">
        Отправить заявку
      </SubmitButton>
    </div>
  );
}

export function JoinForm() {
  return (
    <ActionForm action={submitJoinApplication} className="relative">
      <SuccessOrForm />
    </ActionForm>
  );
}
