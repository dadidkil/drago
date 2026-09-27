import { db, Prisma, type Survey } from "@drago/database";
import {
  currentSurveyPeriod,
  formatDateTime,
  surveyQuestionsSchema,
  validateSurveyAnswers,
  type SurveyPeriod,
  type SurveyQuestion,
  type SurveySchedule,
} from "@drago/shared";
import { createLogger } from "./logger";
import { notify, notifyByPermission } from "./notifications";

const log = createLogger("surveys");

export function surveySchedule(s: Pick<Survey, "startsAt" | "endsAt" | "periodDays" | "dueDays">): SurveySchedule {
  return { startsAt: s.startsAt, endsAt: s.endsAt, periodDays: s.periodDays, dueDays: s.dueDays };
}

export function currentSurveyPeriodFor(s: Pick<Survey, "startsAt" | "endsAt" | "periodDays" | "dueDays">, now: Date = new Date()): SurveyPeriod | null {
  return currentSurveyPeriod(surveySchedule(s), now);
}

/** Вопросы из JSON; повреждённые данные не роняют страницу. */
export function surveyQuestions(s: Pick<Survey, "questions">): SurveyQuestion[] {
  const parsed = surveyQuestionsSchema.safeParse(s.questions);
  return parsed.success ? parsed.data : [];
}

/** Условие Prisma «пользователь входит в аудиторию формы». */
export function surveyAudienceWhere(s: Pick<Survey, "minRoleLevel" | "maxRoleLevel">): Prisma.UserWhereInput {
  return { status: "ACTIVE", role: { level: { gte: s.minRoleLevel, ...(s.maxRoleLevel != null ? { lte: s.maxRoleLevel } : {}) } } };
}

export function inSurveyAudience(s: Pick<Survey, "minRoleLevel" | "maxRoleLevel">, roleLevel: number): boolean {
  return roleLevel >= s.minRoleLevel && (s.maxRoleLevel == null || roleLevel <= s.maxRoleLevel);
}

export type UserSurveyStatus = "done" | "pending" | "overdue";

export interface UserSurvey {
  survey: Survey;
  period: SurveyPeriod;
  status: UserSurveyStatus;
  completedAt: Date | null;
}

/** Активные формы пользователя в текущих периодах со статусом прохождения. */
export async function surveysForUser(user: { id: string; roleLevel: number }, now: Date = new Date()): Promise<UserSurvey[]> {
  const surveys = await db.survey.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      minRoleLevel: { lte: user.roleLevel },
      AND: [{ OR: [{ maxRoleLevel: null }, { maxRoleLevel: { gte: user.roleLevel } }] }],
    },
    orderBy: { createdAt: "asc" },
  });
  if (surveys.length === 0) return [];
  const withPeriods = surveys.flatMap((survey) => {
    const period = currentSurveyPeriod(surveySchedule(survey), now);
    return period ? [{ survey, period }] : [];
  });
  const completions = await db.surveyCompletion.findMany({
    where: { userId: user.id, OR: withPeriods.map(({ survey, period }) => ({ surveyId: survey.id, period: period.index })) },
    select: { surveyId: true, completedAt: true },
  });
  const done = new Map(completions.map((c) => [c.surveyId, c.completedAt]));
  return withPeriods.map(({ survey, period }) => {
    const completedAt = done.get(survey.id) ?? null;
    const status: UserSurveyStatus = completedAt ? "done" : now >= period.dueAt ? "overdue" : "pending";
    return { survey, period, status, completedAt };
  });
}

/** Форма, из-за которой кабинет закрыт: просрочена и настроена на блокировку. */
export function blockingSurvey(list: UserSurvey[]): UserSurvey | null {
  return list.find((s) => s.status === "overdue" && s.survey.enforcement === "BLOCK") ?? null;
}

export class SurveyError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "SurveyError";
  }
}

/**
 * Принять ответы пользователя на текущий период.
 * Проверка аудитории и периода — здесь, на сервере. Анонимная форма хранит ответ без userId и без времени прохождения.
 */
export async function submitSurvey(surveyId: string, user: { id: string; roleLevel: number; name: string }, raw: Record<string, unknown>, now: Date = new Date()) {
  const survey = await db.survey.findUnique({ where: { id: surveyId } });
  if (!survey || !survey.isActive || !inSurveyAudience(survey, user.roleLevel)) throw new SurveyError("Форма недоступна");
  const period = currentSurveyPeriod(surveySchedule(survey), now);
  if (!period) throw new SurveyError("Форма сейчас не принимает ответы");
  const questions = surveyQuestions(survey);
  const { answers, errors, alerts } = validateSurveyAnswers(questions, raw);
  if (Object.keys(errors).length > 0) throw new SurveyError("Ответьте на обязательные вопросы и проверьте ответы", errors);

  const flagged = alerts.length > 0;
  const existing = await db.surveyCompletion.findUnique({ where: { surveyId_userId_period: { surveyId, userId: user.id, period: period.index } } });
  if (existing && !(survey.allowEdit && !survey.anonymous)) throw new SurveyError("Ты уже прошёл(а) эту форму в текущем периоде");

  try {
    if (existing) {
      await db.surveyResponse.update({
        where: { surveyId_userId_period: { surveyId, userId: user.id, period: period.index } },
        data: { answers, flagged },
      });
    } else {
      await db.$transaction([
        db.surveyCompletion.create({ data: { surveyId, userId: user.id, period: period.index } }),
        db.surveyResponse.create({
          data: survey.anonymous
            ? { surveyId, period: period.index, answers, flagged, createdAt: period.start }
            : { surveyId, userId: user.id, period: period.index, answers, flagged },
        }),
      ]);
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new SurveyError("Форма уже пройдена");
    throw err;
  }

  if (flagged) {
    // Во внешние каналы — без подробностей ответа: детали только в админке.
    const labels = alerts.map((id) => questions.find((q) => q.id === id)?.label).filter(Boolean);
    await notifyByPermission("surveys.results", {
      type: "SURVEY_ALERT",
      title: `Требует внимания: «${survey.title}»`,
      body: survey.anonymous
        ? `Анонимный ответ. Вопросы: ${labels.join("; ")}`
        : `${user.name}. Вопросы: ${labels.join("; ")}`,
      url: `/admin/surveys/${survey.id}/results?period=${period.index}`,
      excludeUserId: survey.anonymous ? undefined : user.id,
    });
  }
  return { period, flagged, updated: Boolean(existing) };
}

/** Активные участники аудитории, не прошедшие форму в периоде. */
export async function pendingSurveyUsers(survey: Survey, periodIndex: number): Promise<string[]> {
  const users = await db.user.findMany({
    where: { ...surveyAudienceWhere(survey), surveyCompletions: { none: { surveyId: survey.id, period: periodIndex } } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** Захват рассылки: true — эту рассылку ещё никто не делал. */
async function claimDispatch(surveyId: string, period: number, kind: string): Promise<boolean> {
  try {
    await db.surveyDispatch.create({ data: { surveyId, period, kind } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return false;
    throw err;
  }
}

/**
 * Воркер (раз в минуту): уведомления о новом периоде, напоминание до срока, просрочка, сводка командному составу.
 * Каждая рассылка по периоду делается ровно один раз (SurveyDispatch).
 */
export async function surveyDispatchJob(now: Date = new Date()): Promise<void> {
  const surveys = await db.survey.findMany({ where: { isActive: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } });
  for (const s of surveys) {
    const period = currentSurveyPeriod(surveySchedule(s), now);
    if (!period) continue;
    const url = `/cabinet/surveys/${s.id}`;
    const due = formatDateTime(period.dueAt);
    const overdue = now >= period.dueAt;

    if (s.notifyOnStart && !overdue && (await claimDispatch(s.id, period.index, "start"))) {
      const ids = await pendingSurveyUsers(s, period.index);
      await notify({ userIds: ids, type: "SURVEY_DUE", title: `Новая форма: «${s.title}»`, body: `Пройди до ${due}. Это займёт пару минут.`, url });
    }
    if (s.remindBeforeHours && !overdue && now.getTime() >= period.dueAt.getTime() - s.remindBeforeHours * 3_600_000) {
      if (await claimDispatch(s.id, period.index, "reminder")) {
        const ids = await pendingSurveyUsers(s, period.index);
        await notify({ userIds: ids, type: "SURVEY_DUE", title: `Напоминание: «${s.title}»`, body: `Срок — до ${due}.`, url });
      }
    }
    if (overdue && (s.notifyOverdue || s.staffDigest) && (await claimDispatch(s.id, period.index, "overdue"))) {
      const ids = await pendingSurveyUsers(s, period.index);
      if (s.notifyOverdue && ids.length) {
        await notify({
          userIds: ids,
          type: "SURVEY_DUE",
          title: `Просрочено: «${s.title}»`,
          body: s.enforcement === "BLOCK" ? "Срок прошёл. Кабинет откроется после прохождения формы." : "Срок прошёл — пройди форму как можно скорее.",
          url,
        });
      }
      if (s.staffDigest) {
        const total = await db.user.count({ where: surveyAudienceWhere(s) });
        await notifyByPermission("surveys.results", {
          type: "SURVEY_ALERT",
          title: `Итоги периода: «${s.title}»`,
          body: `Прошли ${total - ids.length} из ${total}. Не прошли: ${ids.length}.`,
          url: `/admin/surveys/${s.id}/results?period=${period.index}`,
        });
      }
    }
  }
}

/** Срок хранения: ответы и отметки о прохождении старше retentionDays удаляются. */
export async function surveyRetentionCleanup(now: Date = new Date()): Promise<number> {
  const surveys = await db.survey.findMany({ select: { id: true, retentionDays: true } });
  let removed = 0;
  for (const s of surveys) {
    const before = new Date(now.getTime() - s.retentionDays * 86_400_000);
    const [r, c, d] = await db.$transaction([
      db.surveyResponse.deleteMany({ where: { surveyId: s.id, createdAt: { lt: before } } }),
      db.surveyCompletion.deleteMany({ where: { surveyId: s.id, completedAt: { lt: before } } }),
      db.surveyDispatch.deleteMany({ where: { surveyId: s.id, sentAt: { lt: before } } }),
    ]);
    removed += r.count + c.count + d.count;
  }
  if (removed) log.info("survey retention cleanup", { removed });
  return removed;
}
