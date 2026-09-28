"use client";

import { ActionForm, Field, FormMessage, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { sendMessage } from "./actions";

export function ComposeBox({ defaultTo, inReplyTo }: { defaultTo?: string; inReplyTo?: string }) {
  return (
    <ActionForm action={sendMessage} refreshOnSuccess className="grid gap-4">
      <FormMessage />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Кому" name="to" required>
          <Input name="to" type="email" defaultValue={defaultTo} placeholder="boec@dragotop.ru" autoComplete="off" />
        </Field>
        <Field label="Тема" name="subject">
          <Input name="subject" autoComplete="off" />
        </Field>
      </div>
      <Field label="Письмо" name="text" required>
        <Textarea name="text" rows={8} />
      </Field>
      {inReplyTo && <input type="hidden" name="inReplyTo" value={inReplyTo} />}
      <div>
        <SubmitButton>Отправить</SubmitButton>
      </div>
    </ActionForm>
  );
}
