import { z } from "zod";

/**
 * Формы (самочувствие, обратная связь и т. п.): схема вопросов, проверка ответов, периоды.
 * Изоморфный код — используется в конструкторе (браузер), при приёме ответов (сервер) и в воркере.
 */

export const SURVEY_QUESTION_TYPES = {
  SCALE: "Шкала",
  SINGLE: "Один вариант",
  MULTI: "Несколько вариантов",
  YES_NO: "Да / нет",
  TEXT: "Короткий ответ",
  LONG_TEXT: "Развёрнутый ответ",
  NUMBER: "Число",
} as const;
export type SurveyQuestionType = keyof typeof SURVEY_QUESTION_TYPES;

export const SURVEY_ALERT_OPS = {
  lte: "меньше или равно",
  gte: "больше или равно",
  eq: "равно",
  neq: "не равно",
  includes: "выбран вариант",
  filled: "заполнено",
} as const;
export type SurveyAlertOp = keyof typeof SURVEY_ALERT_OPS;

export const SURVEY_ENFORCEMENT_LABELS = {
  REMIND: "Только напоминания",
  BANNER: "Баннер в кабинете и напоминания",
  BLOCK: "После срока кабинет закрыт, пока форма не пройдена",
} as const;
export type SurveyEnforcementKey = keyof typeof SURVEY_ENFORCEMENT_LABELS;

const questionId = z.string().regex(/^[a-z0-9]{4,24}$/, "Неверный идентификатор вопроса");
const text = (max: number) => z.string().trim().max(max);

export const surveyQuestionSchema = z
  .object({
    id: questionId,
    type: z.enum(Object.keys(SURVEY_QUESTION_TYPES) as [SurveyQuestionType, ...SurveyQuestionType[]]),
    label: text(300).min(1, "Введите текст вопроса"),
    help: text(500).optional(),
    required: z.boolean().default(false),
    options: z.array(text(120).min(1)).max(20).optional(),
    scale: z
      .object({
        min: z.number().int().min(0).max(1),
        max: z.number().int().min(2).max(10),
        minLabel: text(40).optional(),
        maxLabel: text(40).optional(),
      })
      .optional(),
    number: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
    /** Показывать вопрос, только если ответ на более ранний вопрос — один из values. */
    showIf: z.object({ questionId, values: z.array(text(120)).min(1).max(20) }).optional(),
    /** Сигнал командному составу, если ответ удовлетворяет условию. */
    alert: z.object({ op: z.enum(Object.keys(SURVEY_ALERT_OPS) as [SurveyAlertOp, ...SurveyAlertOp[]]), value: text(120).default("") }).optional(),
  })
  .superRefine((q, ctx) => {
    if ((q.type === "SINGLE" || q.type === "MULTI") && (q.options?.length ?? 0) < 2)
      ctx.addIssue({ code: "custom", message: `«${q.label}»: нужно минимум два варианта ответа`, path: ["options"] });
    if (q.type === "SCALE" && !q.scale) ctx.addIssue({ code: "custom", message: `«${q.label}»: задайте шкалу`, path: ["scale"] });
  });
export type SurveyQuestion = z.infer<typeof surveyQuestionSchema>;

export const surveyQuestionsSchema = z
  .array(surveyQuestionSchema)
  .min(1, "Добавьте хотя бы один вопрос")
  .max(50, "Не больше 50 вопросов")
  .superRefine((qs, ctx) => {
    const seen = new Set<string>();
    qs.forEach((q, i) => {
      if (seen.has(q.id)) ctx.addIssue({ code: "custom", message: "Повторяющийся идентификатор вопроса", path: [i, "id"] });
      if (q.showIf && !seen.has(q.showIf.questionId))
        ctx.addIssue({ code: "custom", message: `«${q.label}»: условие может ссылаться только на вопрос выше`, path: [i, "showIf"] });
      seen.add(q.id);
    });
  });

export type SurveyAnswerValue = string | string[] | number;
export type SurveyAnswers = Record<string, SurveyAnswerValue>;

/** Ответ в виде строк — для условий показа и сигналов. */
function answerStrings(v: SurveyAnswerValue | undefined): string[] {
  if (v === undefined || v === "") return [];
  return Array.isArray(v) ? v : [String(v)];
}

export function isQuestionVisible(q: SurveyQuestion, answers: SurveyAnswers): boolean {
  if (!q.showIf) return true;
  const got = answerStrings(answers[q.showIf.questionId]);
  return got.some((g) => q.showIf!.values.includes(g));
}

export function yesNoLabel(v: string): string {
  return v === "yes" ? "Да" : v === "no" ? "Нет" : v;
}

/** Срабатывает ли сигнал для ответа. */
export function alertTriggered(q: SurveyQuestion, v: SurveyAnswerValue | undefined): boolean {
  if (!q.alert) return false;
  const got = answerStrings(v);
  if (got.length === 0) return false;
  const { op, value } = q.alert;
  const num = Number(got[0]);
  const target = Number(value);
  switch (op) {
    case "lte":
      return Number.isFinite(num) && Number.isFinite(target) && num <= target;
    case "gte":
      return Number.isFinite(num) && Number.isFinite(target) && num >= target;
    case "eq":
      return got[0] === value;
    case "neq":
      return got[0] !== value;
    case "includes":
      return got.includes(value);
    case "filled":
      return got.some((g) => g.trim() !== "");
  }
}

export interface SurveyValidation {
  answers: SurveyAnswers;
  errors: Record<string, string>;
  /** id вопросов, где сработал сигнал. */
  alerts: string[];
}

/**
 * Проверка ответов на сервере: типы, диапазоны, обязательность (только для видимых вопросов).
 * Ответы на скрытые условием вопросы отбрасываются.
 */
export function validateSurveyAnswers(questions: SurveyQuestion[], raw: Record<string, unknown>): SurveyValidation {
  const answers: SurveyAnswers = {};
  const errors: Record<string, string> = {};
  const alerts: string[] = [];
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : Array.isArray(v) && typeof v[0] === "string" ? v[0].trim() : "");

  for (const q of questions) {
    if (!isQuestionVisible(q, answers)) continue;
    const rawValue = raw[q.id];
    let value: SurveyAnswerValue | undefined;
    let error: string | undefined;

    switch (q.type) {
      case "SCALE": {
        const s = str(rawValue);
        if (s !== "") {
          const n = Number(s);
          const { min, max } = q.scale!;
          if (!Number.isInteger(n) || n < min || n > max) error = `Выберите значение от ${min} до ${max}`;
          else value = n;
        }
        break;
      }
      case "NUMBER": {
        const s = str(rawValue).replace(",", ".");
        if (s !== "") {
          const n = Number(s);
          if (!Number.isFinite(n)) error = "Введите число";
          else if (q.number?.min !== undefined && n < q.number.min) error = `Не меньше ${q.number.min}`;
          else if (q.number?.max !== undefined && n > q.number.max) error = `Не больше ${q.number.max}`;
          else value = n;
        }
        break;
      }
      case "SINGLE": {
        const s = str(rawValue);
        if (s !== "") {
          if (!q.options?.includes(s)) error = "Выберите вариант из списка";
          else value = s;
        }
        break;
      }
      case "YES_NO": {
        const s = str(rawValue);
        if (s !== "") {
          if (s !== "yes" && s !== "no") error = "Выберите «Да» или «Нет»";
          else value = s;
        }
        break;
      }
      case "MULTI": {
        const list = (Array.isArray(rawValue) ? rawValue : rawValue === undefined ? [] : [rawValue]).filter((x): x is string => typeof x === "string");
        const unique = [...new Set(list.map((x) => x.trim()))].filter(Boolean);
        if (unique.some((x) => !q.options?.includes(x))) error = "Выберите варианты из списка";
        else if (unique.length) value = unique;
        break;
      }
      case "TEXT":
      case "LONG_TEXT": {
        const s = str(rawValue);
        const max = q.type === "TEXT" ? 300 : 3000;
        if (s.length > max) error = `Не длиннее ${max} символов`;
        else if (s !== "") value = s;
        break;
      }
    }

    if (!error && value === undefined && q.required) error = "Обязательный вопрос";
    if (error) errors[q.id] = error;
    else if (value !== undefined) {
      answers[q.id] = value;
      if (alertTriggered(q, value)) alerts.push(q.id);
    }
  }
  return { answers, errors, alerts };
}

/** Ответ для отображения человеку. */
export function formatSurveyAnswer(q: SurveyQuestion, v: SurveyAnswerValue | undefined): string {
  if (v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.join("; ");
  if (q.type === "YES_NO") return yesNoLabel(String(v));
  if (q.type === "SCALE") return `${v} из ${q.scale?.max ?? ""}`.trim();
  return String(v);
}

// ── Периоды ─────────────────────────────────────────────────────────────────

export interface SurveySchedule {
  startsAt: Date;
  endsAt: Date | null;
  /** null — однократная форма. */
  periodDays: number | null;
  /** Сколько дней от начала периода даётся на прохождение. */
  dueDays: number;
}

export interface SurveyPeriod {
  index: number;
  start: Date;
  /** Конец периода (начало следующего); null — у однократной формы. */
  end: Date | null;
  dueAt: Date;
}

const DAY_MS = 86_400_000;

export function surveyPeriodByIndex(s: SurveySchedule, index: number): SurveyPeriod {
  if (!s.periodDays) {
    return { index: 0, start: s.startsAt, end: null, dueAt: new Date(s.startsAt.getTime() + s.dueDays * DAY_MS) };
  }
  const start = new Date(s.startsAt.getTime() + index * s.periodDays * DAY_MS);
  const end = new Date(start.getTime() + s.periodDays * DAY_MS);
  const dueAt = new Date(start.getTime() + Math.min(s.dueDays, s.periodDays) * DAY_MS);
  return { index, start, end, dueAt };
}

/** Текущий период формы или null, если форма ещё не началась или уже закончилась. */
export function currentSurveyPeriod(s: SurveySchedule, now: Date = new Date()): SurveyPeriod | null {
  if (now < s.startsAt) return null;
  if (s.endsAt && now >= s.endsAt) return null;
  if (!s.periodDays) return surveyPeriodByIndex(s, 0);
  const index = Math.floor((now.getTime() - s.startsAt.getTime()) / (s.periodDays * DAY_MS));
  return surveyPeriodByIndex(s, index);
}

/** Номер последнего начавшегося периода (для истории результатов); -1 — форма ещё не начиналась. */
export function lastSurveyPeriodIndex(s: SurveySchedule, now: Date = new Date()): number {
  const until = s.endsAt && s.endsAt < now ? new Date(s.endsAt.getTime() - 1) : now;
  if (until < s.startsAt) return -1;
  if (!s.periodDays) return 0;
  return Math.floor((until.getTime() - s.startsAt.getTime()) / (s.periodDays * DAY_MS));
}

export function describeSurveySchedule(s: Pick<SurveySchedule, "periodDays" | "dueDays">): string {
  const due = s.periodDays ? Math.min(s.dueDays, s.periodDays) : s.dueDays;
  return `${s.periodDays ? `каждые ${s.periodDays} дн.` : "однократно"}, срок — ${due} дн.`;
}

/** Короткий случайный id вопроса (в браузере и на сервере). */
export function newQuestionId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  const bytes = new Uint8Array(10);
  globalThis.crypto.getRandomValues(bytes);
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

// ── Шаблоны ─────────────────────────────────────────────────────────────────

export interface SurveyTemplate {
  key: string;
  title: string;
  description: string;
  anonymous: boolean;
  questions: SurveyQuestion[];
}

export const SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    key: "wellbeing",
    title: "Самочувствие",
    description:
      "Пара минут раз в две недели. Ответы помогают командиру и комиссару вовремя заметить, если кому-то тяжело. Если нужна помощь прямо сейчас — не жди формы, напиши командиру.",
    anonymous: false,
    questions: [
      {
        id: "mood",
        type: "SCALE",
        label: "Как ты себя чувствуешь в целом?",
        required: true,
        scale: { min: 1, max: 5, minLabel: "Очень плохо", maxLabel: "Отлично" },
        alert: { op: "lte", value: "2" },
      },
      {
        id: "energy",
        type: "SCALE",
        label: "Как с усталостью и сном?",
        required: true,
        scale: { min: 1, max: 5, minLabel: "Совсем без сил", maxLabel: "Полон(на) сил" },
        alert: { op: "lte", value: "2" },
      },
      {
        id: "team",
        type: "SCALE",
        label: "Как тебе в команде?",
        required: true,
        scale: { min: 1, max: 5, minLabel: "Плохо", maxLabel: "Отлично" },
      },
      { id: "health", type: "YES_NO", label: "Есть жалобы на здоровье или травмы?", required: true, alert: { op: "eq", value: "yes" } },
      {
        id: "healthtext",
        type: "LONG_TEXT",
        label: "Расскажи, что беспокоит",
        help: "Это увидят только командир и комиссар.",
        required: false,
        showIf: { questionId: "health", values: ["yes"] },
      },
      {
        id: "talk",
        type: "SINGLE",
        label: "Хочешь поговорить с командным составом?",
        required: true,
        options: ["Нет, всё хорошо", "Да, с командиром", "Да, с комиссаром"],
        alert: { op: "neq", value: "Нет, всё хорошо" },
      },
      { id: "ideas", type: "LONG_TEXT", label: "Что можно улучшить в отряде?", required: false },
    ],
  },
  {
    key: "feedback",
    title: "Обратная связь (анонимно)",
    description: "Анонимная форма: командный состав видит, что ты её прошёл(а), но не видит, какие ответы твои.",
    anonymous: true,
    questions: [
      {
        id: "overall",
        type: "SCALE",
        label: "Насколько тебе нравится работа в отряде последние две недели?",
        required: true,
        scale: { min: 1, max: 10, minLabel: "Совсем не нравится", maxLabel: "Очень нравится" },
      },
      {
        id: "liked",
        type: "MULTI",
        label: "Что было лучше всего?",
        required: false,
        options: ["Работа на объекте", "Команда", "Мероприятия", "Обучение", "Командный состав"],
      },
      {
        id: "problems",
        type: "MULTI",
        label: "Что мешало?",
        required: false,
        options: ["Усталость", "Непонятные задачи", "Конфликты", "Расписание", "Условия на объекте"],
      },
      { id: "suggest", type: "LONG_TEXT", label: "Что предложишь изменить?", required: false },
    ],
  },
];
