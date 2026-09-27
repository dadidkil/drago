"use client";

import { useState, type ReactNode } from "react";
import { isQuestionVisible, type SurveyAnswers, type SurveyQuestion } from "@drago/shared";
import { ActionForm, FieldError, FormMessage, SubmitButton } from "@/components/ui/form";
import { cn } from "@/components/ui/cn";
import { submitSurveyAction } from "../actions";

const inputCls =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[0.95rem] text-ink focus:border-water focus:outline-none focus:ring-3 focus:ring-water/20";

/** Крупные «таблетки» для шкалы и вариантов: удобно нажимать пальцем на телефоне. */
function Pill({ name, value, checked, onChange, type = "radio", children }: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  type?: "radio" | "checkbox";
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-water/30",
        checked ? "border-fire bg-fire text-white" : "border-line bg-white hover:border-fire/50",
      )}
    >
      <input type={type} name={name} value={value} checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      {children}
    </label>
  );
}

export function SurveyForm({ surveyId, questions, initial, preview }: { surveyId: string; questions: SurveyQuestion[]; initial?: SurveyAnswers; preview?: boolean }) {
  const [answers, setAnswers] = useState<SurveyAnswers>(initial ?? {});
  const set = (id: string, v: SurveyAnswers[string] | undefined) =>
    setAnswers((a) => {
      const next = { ...a };
      if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) delete next[id];
      else next[id] = v;
      return next;
    });

  const visible = questions.filter((q) => isQuestionVisible(q, answers));

  return (
    <ActionForm action={submitSurveyAction} className="grid gap-5">
      <input type="hidden" name="surveyId" value={surveyId} />
      <FormMessage />
      {visible.map((q, i) => {
        const v = answers[q.id];
        return (
          <fieldset key={q.id} className="rounded-2xl border border-line bg-white p-5">
            <legend className="sr-only">{q.label}</legend>
            <p className="font-semibold" aria-hidden>
              {i + 1}. {q.label}
              {q.required && <span className="text-fire"> *</span>}
            </p>
            {q.help && <p className="mt-1 text-sm text-muted">{q.help}</p>}
            <div className="mt-3">
              {q.type === "SCALE" && q.scale && (
                <div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: q.scale.max - q.scale.min + 1 }, (_, k) => q.scale!.min + k).map((n) => (
                      <Pill key={n} name={q.id} value={String(n)} checked={v === n || v === String(n)} onChange={() => set(q.id, n)}>
                        <span className="min-w-5 text-center">{n}</span>
                      </Pill>
                    ))}
                  </div>
                  {(q.scale.minLabel || q.scale.maxLabel) && (
                    <div className="mt-2 flex justify-between gap-4 text-xs text-muted">
                      <span>
                        {q.scale.min} — {q.scale.minLabel}
                      </span>
                      <span className="text-right">
                        {q.scale.max} — {q.scale.maxLabel}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {q.type === "YES_NO" && (
                <div className="flex gap-2">
                  {[
                    ["yes", "Да"],
                    ["no", "Нет"],
                  ].map(([val, label]) => (
                    <Pill key={val} name={q.id} value={val!} checked={v === val} onChange={() => set(q.id, val)}>
                      {label}
                    </Pill>
                  ))}
                </div>
              )}
              {q.type === "SINGLE" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options?.map((o) => (
                    <Pill key={o} name={q.id} value={o} checked={v === o} onChange={() => set(q.id, o)}>
                      {o}
                    </Pill>
                  ))}
                </div>
              )}
              {q.type === "MULTI" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options?.map((o) => {
                    const list = Array.isArray(v) ? v : [];
                    return (
                      <Pill
                        key={o}
                        type="checkbox"
                        name={`${q.id}[]`}
                        value={o}
                        checked={list.includes(o)}
                        onChange={(c) => set(q.id, c ? [...list, o] : list.filter((x) => x !== o))}
                      >
                        {o}
                      </Pill>
                    );
                  })}
                </div>
              )}
              {q.type === "TEXT" && (
                <input name={q.id} className={inputCls} maxLength={300} value={typeof v === "string" ? v : ""} onChange={(e) => set(q.id, e.target.value)} aria-label={q.label} />
              )}
              {q.type === "LONG_TEXT" && (
                <textarea
                  name={q.id}
                  className={cn(inputCls, "min-h-28 resize-y")}
                  maxLength={3000}
                  value={typeof v === "string" ? v : ""}
                  onChange={(e) => set(q.id, e.target.value)}
                  aria-label={q.label}
                />
              )}
              {q.type === "NUMBER" && (
                <input
                  name={q.id}
                  type="text"
                  inputMode="decimal"
                  className={cn(inputCls, "max-w-40")}
                  value={v === undefined ? "" : String(v)}
                  onChange={(e) => set(q.id, e.target.value)}
                  aria-label={q.label}
                />
              )}
              {/* Ошибка с прошлой отправки прячется, как только на вопрос ответили. */}
              {v === undefined && <FieldError name={q.id} />}
            </div>
          </fieldset>
        );
      })}
      <div>
        {preview ? (
          <p className="rounded-xl bg-paper-2 px-4 py-3 text-sm text-muted">Предпросмотр: отправка отключена.</p>
        ) : (
          <SubmitButton pendingText="Отправляем…">Отправить</SubmitButton>
        )}
      </div>
    </ActionForm>
  );
}
