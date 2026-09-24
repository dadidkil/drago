"use client";

import { ActionForm, Checkbox, Field, FormMessage, Input, InlineAction, SubmitButton } from "@/components/ui/form";
import { saveIntegrations, sendTestEmail } from "./actions";

export function IntegrationsForm({ s }: { s: { telegramBotUsername: string; telegramNotifyApplications: boolean } }) {
  return (
    <ActionForm action={saveIntegrations} className="grid gap-4">
      <FormMessage />
      <Field label="Имя Telegram-бота (для ссылок привязки)" name="telegramBotUsername" hint="Без @. Если задан TELEGRAM_BOT_USERNAME в .env — используется он.">
        <Input name="telegramBotUsername" defaultValue={s.telegramBotUsername} placeholder="drago_top_bot" />
      </Field>
      <Checkbox name="telegramNotifyApplications" defaultChecked={s.telegramNotifyApplications} label="Уведомлять командный состав о новых заявках в Telegram (иначе — только email и кабинет)" />
      <div>
        <SubmitButton>Сохранить</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function TestEmailButton() {
  return <InlineAction action={sendTestEmail} fields={{}} label="Отправить тестовое письмо себе" variant="secondary" refresh={false} />;
}
