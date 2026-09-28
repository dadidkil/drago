"use client";

import { useState } from "react";
import { CheckCheck, Play, Send, Undo2 } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { ActionForm, Field, FormMessage, InlineAction, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { acceptAllSubmitted, addTaskComment, reviewTaskAction, startTaskAction, submitTaskAction } from "../actions";

/** Панель исполнителя: взять в работу и сдать (с комментарием и файлами). */
export function AssigneePanel({ taskId, status }: { taskId: string; status: "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "RETURNED" | "ACCEPTED" }) {
  const [open, setOpen] = useState(status === "IN_PROGRESS" || status === "RETURNED");
  if (status === "ACCEPTED" || status === "SUBMITTED") return null;
  return (
    <div className="grid gap-3">
      {!open ? (
        <div className="flex flex-wrap gap-2">
          {(status === "ASSIGNED" || status === "RETURNED") && (
            <InlineAction action={startTaskAction} fields={{ taskId }} label={<><Play className="size-4" aria-hidden /> Взять в работу</>} variant="secondary" />
          )}
          <button type="button" onClick={() => setOpen(true)} className={buttonClass("primary", "sm")}>
            <Send className="size-4" aria-hidden /> Сдать задачу
          </button>
        </div>
      ) : (
        <ActionForm action={submitTaskAction} refreshOnSuccess className="grid gap-3 rounded-2xl bg-paper p-4">
          <input type="hidden" name="taskId" value={taskId} />
          <p className="font-semibold">Сдать задачу</p>
          <FormMessage />
          <Field label="Что сделано" name="note" hint="Необязательно: ссылка, короткий отчёт, вопрос проверяющему">
            <Textarea name="note" rows={3} maxLength={2000} />
          </Field>
          <Field label="Файлы" name="files" hint="Фото, скан, документ — до 10 файлов по 15 МБ">
            <Input name="files[]" type="file" multiple className="py-2 text-sm" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <SubmitButton pendingText="Сдаём…">
              <Send className="size-4" aria-hidden /> Сдать на проверку
            </SubmitButton>
            {(status === "ASSIGNED" || status === "RETURNED") && (
              <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "md")}>
                Позже
              </button>
            )}
          </div>
        </ActionForm>
      )}
    </div>
  );
}

/** Проверка сдачи конкретного исполнителя: принять или вернуть с пояснением. */
export function ReviewButtons({ taskId, userId }: { taskId: string; userId: string }) {
  const [returning, setReturning] = useState(false);
  if (returning) {
    return (
      <ActionForm action={reviewTaskAction} refreshOnSuccess className="grid w-full gap-2">
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="decision" value="return" />
        <FormMessage />
        <Textarea name="note" rows={2} maxLength={2000} placeholder="Что нужно доработать?" aria-label="Что нужно доработать" required />
        <div className="flex gap-2">
          <SubmitButton size="sm" variant="secondary">
            <Undo2 className="size-4" aria-hidden /> Вернуть
          </SubmitButton>
          <button type="button" onClick={() => setReturning(false)} className={buttonClass("ghost", "sm")}>
            Отмена
          </button>
        </div>
      </ActionForm>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <InlineAction
        action={reviewTaskAction}
        fields={{ taskId, userId, decision: "accept" }}
        label={<><CheckCheck className="size-4" aria-hidden /> Принять</>}
        variant="primary"
      />
      <button type="button" onClick={() => setReturning(true)} className={buttonClass("ghost", "sm", "border border-line")}>
        <Undo2 className="size-4" aria-hidden /> На доработку
      </button>
    </div>
  );
}

export function AcceptAllButton({ taskId, count }: { taskId: string; count: number }) {
  return (
    <InlineAction
      action={acceptAllSubmitted}
      fields={{ taskId }}
      label={<><CheckCheck className="size-4" aria-hidden /> Принять все сданные ({count})</>}
      variant="secondary"
      confirm={`Принять ${count} сданных работ?`}
    />
  );
}

export function CommentForm({ taskId }: { taskId: string }) {
  return (
    <ActionForm action={addTaskComment} resetOnSuccess refreshOnSuccess className="grid gap-3 rounded-2xl border border-line bg-white p-4">
      <input type="hidden" name="taskId" value={taskId} />
      <FormMessage />
      <Field label="Комментарий" name="body">
        <Textarea name="body" rows={3} maxLength={2000} required />
      </Field>
      <Field label="Файлы" name="files" hint="До 5 файлов: PDF, документы, изображения; до 15 МБ каждый">
        <Input name="files[]" type="file" multiple className="py-2 text-sm" />
      </Field>
      <div>
        <SubmitButton size="sm">Отправить</SubmitButton>
      </div>
    </ActionForm>
  );
}
