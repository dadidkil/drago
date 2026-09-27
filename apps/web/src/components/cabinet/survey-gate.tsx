"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ClipboardCheck, Lock } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export interface PendingSurvey {
  id: string;
  title: string;
  due: string;
  overdue: boolean;
}

/** Где можно находиться, пока кабинет закрыт просроченной формой. */
const ALLOWED_WHEN_BLOCKED = ["/cabinet/surveys", "/cabinet/security", "/cabinet/help"];

/**
 * Баннер обязательных форм и блокировка кабинета.
 * Клиентский компонент: layout не перерисовывается при переходах, а usePathname — да,
 * поэтому блокировку нельзя обойти переходом по меню. На сервере (SSR) тоже срабатывает сразу.
 */
export function SurveyGate({ pending, blocked, children }: { pending: PendingSurvey[]; blocked: PendingSurvey | null; children: ReactNode }) {
  const pathname = usePathname();
  const onSurveys = pathname.startsWith("/cabinet/surveys");

  if (blocked && !ALLOWED_WHEN_BLOCKED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-danger/30 bg-white p-6 text-center sm:p-8">
        <Lock className="mx-auto size-8 text-danger" aria-hidden />
        <h1 className="mt-3 text-xl font-semibold">Сначала пройди форму</h1>
        <p className="mt-2 text-muted">
          Срок формы «{blocked.title}» прошёл ({blocked.due}). Кабинет откроется, как только ты её пройдёшь — это пара минут.
        </p>
        <Link href={`/cabinet/surveys/${blocked.id}`} className={buttonClass("primary", "lg", "mt-6")}>
          Пройти форму
        </Link>
      </div>
    );
  }

  return (
    <>
      {!onSurveys && pending.length > 0 && (
        <div className="mb-6 grid gap-2" role="status">
          {pending.map((s) => (
            <Link
              key={s.id}
              href={`/cabinet/surveys/${s.id}`}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${s.overdue ? "bg-[#fdecea] text-danger" : "bg-fire-soft text-[#8f2508]"}`}
            >
              <ClipboardCheck className="size-5 shrink-0" aria-hidden />
              <span>
                {s.overdue ? "Просрочена форма" : "Нужно пройти форму"} «{s.title}» — {s.overdue ? `срок был ${s.due}` : `до ${s.due}`}
              </span>
              <span className="ml-auto shrink-0 underline">Пройти</span>
            </Link>
          ))}
        </div>
      )}
      {children}
    </>
  );
}
