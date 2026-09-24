"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { ActionData, ActionForm, FormMessage, SubmitButton } from "@/components/ui/form";
import { revealTemporaryPassword } from "./actions";

function PasswordBox({ password }: { password: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-paper p-3">
      <code className="flex-1 font-mono text-lg break-all select-all">{password}</code>
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center rounded-lg bg-white hover:bg-paper-2"
        aria-label="Скопировать пароль"
        onClick={async () => {
          await navigator.clipboard.writeText(password);
          setCopied(true);
        }}
      >
        {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}

export function RevealPassword() {
  return (
    <ActionForm action={revealTemporaryPassword} className="grid gap-3" confirmMessage="Пароль будет показан один раз. Показать сейчас?">
      <FormMessage />
      <ActionData>{(data) => <PasswordBox password={String(data.password)} />}</ActionData>
      <div>
        <SubmitButton>Показать временный пароль</SubmitButton>
      </div>
    </ActionForm>
  );
}
