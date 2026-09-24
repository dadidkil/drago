"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="flex min-h-[60svh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold">Что-то пошло не так</h1>
      <p className="mt-2 text-muted">Попробуйте обновить страницу. Если ошибка повторяется — сообщите администратору.</p>
      {error.digest && <p className="mt-2 text-xs text-muted">Код ошибки: {error.digest}</p>}
      <button type="button" onClick={reset} className="mt-6 rounded-xl bg-ink px-5 py-2.5 font-semibold text-paper">
        Повторить
      </button>
    </main>
  );
}
