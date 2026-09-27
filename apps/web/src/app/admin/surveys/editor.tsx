"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import {
  SURVEY_ALERT_OPS,
  SURVEY_ENFORCEMENT_LABELS,
  SURVEY_QUESTION_TYPES,
  newQuestionId,
  toMoscowInputValue,
  type SurveyAlertOp,
  type SurveyQuestion,
  type SurveyQuestionType,
} from "@drago/shared";
import { AudienceSelect } from "@/components/admin/pickers";
import { buttonClass } from "@/components/ui/button";
import { ActionForm, Checkbox, Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { saveSurvey } from "./actions";

export interface SurveyEditorValue {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  questions: SurveyQuestion[];
  minRoleLevel: number;
  maxRoleLevel: number | null;
  startsAt: Date;
  endsAt: Date | null;
  periodDays: number | null;
  dueDays: number;
  enforcement: keyof typeof SURVEY_ENFORCEMENT_LABELS;
  notifyOnStart: boolean;
  remindBeforeHours: number | null;
  notifyOverdue: boolean;
  staffDigest: boolean;
  anonymous: boolean;
  allowEdit: boolean;
  retentionDays: number;
}

const inputCls =
  "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink focus:border-water focus:outline-none focus:ring-3 focus:ring-water/20";
const labelCls = "mb-1 block text-xs font-medium text-muted";

/** Какие условия сигнала имеют смысл для типа вопроса. */
const ALERT_OPS_BY_TYPE: Record<SurveyQuestionType, SurveyAlertOp[]> = {
  SCALE: ["lte", "gte", "eq"],
  NUMBER: ["lte", "gte"],
  SINGLE: ["eq", "neq"],
  YES_NO: ["eq"],
  MULTI: ["includes"],
  TEXT: ["filled"],
  LONG_TEXT: ["filled"],
};

function blankQuestion(type: SurveyQuestionType = "SCALE"): SurveyQuestion {
  return withTypeDefaults({ id: newQuestionId(), type, label: "", required: true });
}

function withTypeDefaults(q: SurveyQuestion): SurveyQuestion {
  const next: SurveyQuestion = { ...q };
  if (q.type === "SCALE" && !q.scale) next.scale = { min: 1, max: 5, minLabel: "Плохо", maxLabel: "Отлично" };
  if ((q.type === "SINGLE" || q.type === "MULTI") && !q.options?.length) next.options = ["Вариант 1", "Вариант 2"];
  if (q.alert && !ALERT_OPS_BY_TYPE[q.type].includes(q.alert.op)) delete next.alert;
  return next;
}

/** Возможные значения ответа (для условий показа). */
function answerChoices(q: SurveyQuestion): { value: string; label: string }[] {
  if (q.type === "YES_NO") return [{ value: "yes", label: "Да" }, { value: "no", label: "Нет" }];
  if (q.type === "SINGLE" || q.type === "MULTI") return (q.options ?? []).map((o) => ({ value: o, label: o }));
  if (q.type === "SCALE" && q.scale) {
    return Array.from({ length: q.scale.max - q.scale.min + 1 }, (_, i) => String(q.scale!.min + i)).map((v) => ({ value: v, label: v }));
  }
  return [];
}

export function SurveyEditor({ survey, locked }: { survey?: SurveyEditorValue; locked: boolean }) {
  const [questions, setQuestions] = useState<SurveyQuestion[]>(survey?.questions.length ? survey.questions : [blankQuestion()]);
  const [repeat, setRepeat] = useState(survey ? survey.periodDays !== null : true);
  const [anonymous, setAnonymous] = useState(survey?.anonymous ?? false);

  const update = (i: number, patch: Partial<SurveyQuestion>) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? withTypeDefaults({ ...q, ...patch }) : q)));
  const remove = (i: number) =>
    setQuestions((qs) => {
      const gone = qs[i]!.id;
      // Условия, ссылавшиеся на удалённый вопрос, снимаем.
      return qs.filter((_, j) => j !== i).map((q) => (q.showIf?.questionId === gone ? { ...q, showIf: undefined } : q));
    });
  const move = (i: number, dir: -1 | 1) =>
    setQuestions((qs) => {
      const j = i + dir;
      if (j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      // Условие может ссылаться только на вопрос выше — иначе снимаем.
      return next.map((q, k) => (q.showIf && !next.slice(0, k).some((p) => p.id === q.showIf!.questionId) ? { ...q, showIf: undefined } : q));
    });
  const duplicate = (i: number) =>
    setQuestions((qs) => [...qs.slice(0, i + 1), { ...structuredClone(qs[i]!), id: newQuestionId() }, ...qs.slice(i + 1)]);

  return (
    <ActionForm action={saveSurvey} className="grid gap-6">
      {survey && <input type="hidden" name="id" value={survey.id} />}
      <input type="hidden" name="questions" value={JSON.stringify(questions)} />
      <FormMessage />

      <Section title="Основное">
        <Field label="Название" name="title" required>
          <Input name="title" defaultValue={survey?.title} maxLength={150} placeholder="Самочувствие" />
        </Field>
        <Field label="Описание для бойцов" name="description" hint="Показывается над вопросами. Markdown.">
          <Textarea name="description" defaultValue={survey?.description ?? ""} rows={3} />
        </Field>
        <Checkbox name="isActive" defaultChecked={survey?.isActive ?? false} label="Форма активна — назначается аудитории по расписанию" />
      </Section>

      <Section title={`Вопросы (${questions.length})`}>
        <ol className="grid gap-4">
          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              q={q}
              index={i}
              total={questions.length}
              earlier={questions.slice(0, i).filter((p) => answerChoices(p).length > 0)}
              onChange={(patch) => update(i, patch)}
              onRemove={() => remove(i)}
              onMove={(dir) => move(i, dir)}
              onDuplicate={() => duplicate(i)}
            />
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SURVEY_QUESTION_TYPES) as SurveyQuestionType[]).map((t) => (
            <button key={t} type="button" onClick={() => setQuestions((qs) => [...qs, blankQuestion(t)])} className={buttonClass("ghost", "sm", "border border-line")}>
              <Plus className="size-4" aria-hidden /> {SURVEY_QUESTION_TYPES[t]}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Кто и когда проходит">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Кому" name="minRoleLevel" hint="Минимальная роль">
            <AudienceSelect defaultValue={survey?.minRoleLevel ?? 20} />
          </Field>
          <Field label="Верхняя граница" name="maxRoleLevel" hint="Например, «Бойцы» — командный состав форму не получает">
            <Select name="maxRoleLevel" defaultValue={survey?.maxRoleLevel != null ? String(survey.maxRoleLevel) : ""}>
              <option value="">Без ограничения</option>
              <option value="10">Кандидаты</option>
              <option value="20">Бойцы</option>
              <option value="40">Командный состав</option>
              <option value="60">Комиссар</option>
              <option value="80">Командир</option>
            </Select>
          </Field>
          <Field label="Начало (МСК)" name="startsAt" required hint={locked ? "Не меняется после первых ответов" : "С этого момента отсчитываются периоды"}>
            <Input name="startsAt" type="datetime-local" defaultValue={toMoscowInputValue(survey?.startsAt)} disabled={locked} />
          </Field>
          <Field label="Окончание (МСК)" name="endsAt" hint="Пусто — без окончания">
            <Input name="endsAt" type="datetime-local" defaultValue={toMoscowInputValue(survey?.endsAt)} />
          </Field>
          <Field label="Повторять" name="repeat">
            <Select name="repeat" value={repeat ? "repeat" : "once"} onChange={(e) => setRepeat(e.target.value === "repeat")} disabled={locked}>
              <option value="repeat">Регулярно</option>
              <option value="once">Однократно</option>
            </Select>
          </Field>
          {repeat && (
            <Field label="Каждые, дней" name="periodDays" hint="14 — раз в две недели">
              <Input name="periodDays" type="number" min={1} max={180} defaultValue={survey?.periodDays ?? 14} disabled={locked} />
            </Field>
          )}
          <Field label="Срок на прохождение, дней" name="dueDays" hint="От начала периода. После — просрочено.">
            <Input name="dueDays" type="number" min={1} max={180} defaultValue={survey?.dueDays ?? 3} />
          </Field>
        </div>
      </Section>

      <Section title="Обязательность и напоминания">
        <Field label="Если не пройдена" name="enforcement">
          <Select name="enforcement" defaultValue={survey?.enforcement ?? "BANNER"}>
            {Object.entries(SURVEY_ENFORCEMENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Checkbox name="notifyOnStart" defaultChecked={survey?.notifyOnStart ?? true} label="Уведомлять о начале периода" />
          <Checkbox name="notifyOverdue" defaultChecked={survey?.notifyOverdue ?? true} label="Уведомлять просрочивших" />
          <Checkbox name="staffDigest" defaultChecked={survey?.staffDigest ?? true} label="Итоги периода командному составу (кто не прошёл)" />
        </div>
        <Field label="Напомнить до срока" name="remindBeforeHours" hint="Тем, кто ещё не прошёл: в кабинет, Telegram и VK по настройкам бойца">
          <Select name="remindBeforeHours" defaultValue={survey ? String(survey.remindBeforeHours ?? "") : "24"}>
            <option value="">Не напоминать</option>
            <option value="6">За 6 часов</option>
            <option value="12">За 12 часов</option>
            <option value="24">За сутки</option>
            <option value="48">За двое суток</option>
            <option value="72">За трое суток</option>
          </Select>
        </Field>
      </Section>

      <Section title="Приватность">
        <Checkbox
          name="anonymous"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
          disabled={locked}
          label={
            <>
              Анонимно — ответы хранятся без имени. Видно только, кто прошёл форму.
              {locked && <span className="text-muted"> (не меняется после первых ответов)</span>}
            </>
          }
        />
        {!anonymous && <Checkbox name="allowEdit" defaultChecked={survey?.allowEdit ?? false} label="Можно изменить ответ до конца периода" />}
        <Field label="Хранить ответы, дней" name="retentionDays" hint="Потом ответы удаляются автоматически. Данные о самочувствии — чувствительные: храните не дольше нужного.">
          <Input name="retentionDays" type="number" min={30} max={1095} defaultValue={survey?.retentionDays ?? 365} />
        </Field>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{survey ? "Сохранить" : "Создать форму"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:p-6">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function QuestionCard({
  q,
  index,
  total,
  earlier,
  onChange,
  onRemove,
  onMove,
  onDuplicate,
}: {
  q: SurveyQuestion;
  index: number;
  total: number;
  earlier: SurveyQuestion[];
  onChange: (patch: Partial<SurveyQuestion>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
}) {
  const conditionSource = q.showIf ? earlier.find((p) => p.id === q.showIf!.questionId) : undefined;
  const alertOps = ALERT_OPS_BY_TYPE[q.type];
  const iconBtn = "inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-paper-2 hover:text-ink disabled:opacity-30";

  return (
    <li className="@container grid gap-3 rounded-xl border border-line bg-paper/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-sm font-semibold text-muted">{index + 1}.</span>
        <select
          aria-label="Тип вопроса"
          className={`${inputCls} w-auto min-w-0 flex-1 @md:flex-none`}
          value={q.type}
          onChange={(e) => onChange({ type: e.target.value as SurveyQuestionType })}
        >
          {Object.entries(SURVEY_QUESTION_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm @md:ml-auto">
          <input type="checkbox" className="size-4 accent-fire" checked={q.required} onChange={(e) => onChange({ required: e.target.checked })} />
          Обязательный
        </label>
        <div className="ml-auto flex">
          <button type="button" className={iconBtn} onClick={() => onMove(-1)} disabled={index === 0} aria-label="Выше">
            <ArrowUp className="size-4" />
          </button>
          <button type="button" className={iconBtn} onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Ниже">
            <ArrowDown className="size-4" />
          </button>
          <button type="button" className={iconBtn} onClick={onDuplicate} aria-label="Копировать вопрос">
            <Copy className="size-4" />
          </button>
          <button type="button" className={`${iconBtn} hover:text-danger`} onClick={onRemove} disabled={total === 1} aria-label="Удалить вопрос">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div>
        <label className={labelCls}>Вопрос</label>
        <input className={inputCls} value={q.label} maxLength={300} onChange={(e) => onChange({ label: e.target.value })} placeholder="Как ты себя чувствуешь?" />
      </div>
      <div>
        <label className={labelCls}>Подсказка (необязательно)</label>
        <input className={inputCls} value={q.help ?? ""} maxLength={500} onChange={(e) => onChange({ help: e.target.value || undefined })} />
      </div>

      {(q.type === "SINGLE" || q.type === "MULTI") && (
        <div>
          <label className={labelCls}>Варианты — по одному в строке</label>
          <textarea
            className={`${inputCls} min-h-24`}
            value={(q.options ?? []).join("\n")}
            onChange={(e) => onChange({ options: e.target.value.split("\n").map((s) => s.slice(0, 120)).slice(0, 20) })}
            onBlur={(e) => onChange({ options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
          />
        </div>
      )}

      {q.type === "SCALE" && q.scale && (
        <div className="grid gap-3 @md:grid-cols-4">
          <div>
            <label className={labelCls}>От</label>
            <select className={inputCls} value={q.scale.min} onChange={(e) => onChange({ scale: { ...q.scale!, min: Number(e.target.value) } })}>
              <option value={0}>0</option>
              <option value={1}>1</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>До</label>
            <select className={inputCls} value={q.scale.max} onChange={(e) => onChange({ scale: { ...q.scale!, max: Number(e.target.value) } })}>
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Подпись минимума</label>
            <input className={inputCls} value={q.scale.minLabel ?? ""} maxLength={40} onChange={(e) => onChange({ scale: { ...q.scale!, minLabel: e.target.value || undefined } })} />
          </div>
          <div>
            <label className={labelCls}>Подпись максимума</label>
            <input className={inputCls} value={q.scale.maxLabel ?? ""} maxLength={40} onChange={(e) => onChange({ scale: { ...q.scale!, maxLabel: e.target.value || undefined } })} />
          </div>
        </div>
      )}

      {q.type === "NUMBER" && (
        <div className="grid gap-3 @md:grid-cols-2">
          {(["min", "max"] as const).map((k) => (
            <div key={k}>
              <label className={labelCls}>{k === "min" ? "Не меньше" : "Не больше"}</label>
              <input
                type="number"
                className={inputCls}
                value={q.number?.[k] ?? ""}
                onChange={(e) => onChange({ number: { ...q.number, [k]: e.target.value === "" ? undefined : Number(e.target.value) } })}
              />
            </div>
          ))}
        </div>
      )}

      <details className="rounded-lg border border-line bg-white px-3 py-2 text-sm" open={Boolean(q.showIf || q.alert)}>
        <summary className="cursor-pointer font-medium">Условие показа и сигнал командному составу</summary>
        <div className="mt-3 grid gap-3">
          <div>
            <label className={labelCls}>Показывать</label>
            <select
              className={inputCls}
              value={q.showIf?.questionId ?? ""}
              onChange={(e) => onChange({ showIf: e.target.value ? { questionId: e.target.value, values: [] } : undefined })}
              disabled={earlier.length === 0}
            >
              <option value="">Всегда</option>
              {earlier.map((p) => (
                <option key={p.id} value={p.id}>
                  Если ответ на «{p.label || "без названия"}» …
                </option>
              ))}
            </select>
            {conditionSource && (
              <div className="mt-2 flex flex-wrap gap-3">
                {answerChoices(conditionSource).map((c) => (
                  <label key={c.value} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      className="size-4 accent-fire"
                      checked={q.showIf!.values.includes(c.value)}
                      onChange={(e) =>
                        onChange({
                          showIf: {
                            questionId: q.showIf!.questionId,
                            values: e.target.checked ? [...q.showIf!.values, c.value] : q.showIf!.values.filter((v) => v !== c.value),
                          },
                        })
                      }
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="grid gap-3 @md:grid-cols-2">
            <div>
              <label className={labelCls}>Сигнал, если ответ</label>
              <select
                className={inputCls}
                value={q.alert?.op ?? ""}
                onChange={(e) => onChange({ alert: e.target.value ? { op: e.target.value as SurveyAlertOp, value: q.alert?.value ?? "" } : undefined })}
              >
                <option value="">Без сигнала</option>
                {alertOps.map((op) => (
                  <option key={op} value={op}>
                    {SURVEY_ALERT_OPS[op]}
                  </option>
                ))}
              </select>
            </div>
            {q.alert && q.alert.op !== "filled" && (
              <div>
                <label className={labelCls}>Значение</label>
                {answerChoices(q).length > 0 && q.type !== "SCALE" ? (
                  <select className={inputCls} value={q.alert.value} onChange={(e) => onChange({ alert: { ...q.alert!, value: e.target.value } })}>
                    <option value="">—</option>
                    {answerChoices(q).map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type="number" className={inputCls} value={q.alert.value} onChange={(e) => onChange({ alert: { ...q.alert!, value: e.target.value } })} />
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-muted">Сигнал приходит тем, у кого есть право «Результаты форм»: в кабинет и в Telegram — без текста ответа.</p>
        </div>
      </details>
    </li>
  );
}

