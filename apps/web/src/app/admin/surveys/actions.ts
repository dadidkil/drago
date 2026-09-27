"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, Prisma } from "@drago/database";
import { audit, currentSurveyPeriodFor, notify, pendingSurveyUsers, rateLimit } from "@drago/core";
import { SURVEY_TEMPLATES, formatDateTime, surveyQuestionsSchema } from "@drago/shared";
import { userAction, UserError, zf } from "@/lib/actions";

const P = "surveys.manage" as const;

const questionsField = z.string().transform((v, ctx) => {
  let json: unknown;
  try {
    json = JSON.parse(v);
  } catch {
    ctx.addIssue({ code: "custom", message: "Не удалось прочитать вопросы" });
    return z.NEVER;
  }
  const parsed = surveyQuestionsSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const idx = typeof issue.path[0] === "number" ? `Вопрос ${issue.path[0] + 1}: ` : "";
    ctx.addIssue({ code: "custom", message: `${idx}${issue.message}` });
    return z.NEVER;
  }
  return parsed.data;
});

const schema = z.object({
  id: zf.id().optional(),
  title: zf.str(2, 150, "Введите название формы"),
  description: zf.optStr(3000),
  isActive: zf.bool(),
  questions: questionsField,
  minRoleLevel: zf.int(0, 100),
  maxRoleLevel: zf.optInt(0, 100),
  startsAt: zf.optDateMsk(),
  endsAt: zf.optDateMsk(),
  repeat: z.enum(["once", "repeat"]).optional(),
  periodDays: zf.optInt(1, 180),
  dueDays: zf.int(1, 180),
  enforcement: z.enum(["REMIND", "BANNER", "BLOCK"]),
  notifyOnStart: zf.bool(),
  remindBeforeHours: zf.optInt(1, 168),
  notifyOverdue: zf.bool(),
  staffDigest: zf.bool(),
  anonymous: zf.bool(),
  allowEdit: zf.bool(),
  retentionDays: zf.int(30, 1095),
});

export const saveSurvey = userAction({ permission: P, schema }, async (d, { user, ip }) => {
  const before = d.id ? await db.survey.findUnique({ where: { id: d.id }, include: { _count: { select: { completions: true } } } }) : null;
  if (d.id && !before) throw new UserError("Форма не найдена");
  // После первых ответов расписание и анонимность не меняются: иначе периоды и ответы перепутаются.
  const locked = (before?._count.completions ?? 0) > 0;

  const startsAt = locked ? before!.startsAt : d.startsAt;
  if (!startsAt) throw new UserError("Укажите дату начала", { startsAt: "Укажите дату начала" });
  const periodDays = locked ? before!.periodDays : d.repeat === "once" ? null : (d.periodDays ?? 14);
  const anonymous = locked ? before!.anonymous : d.anonymous;
  if (d.endsAt && d.endsAt <= startsAt) throw new UserError("Дата окончания должна быть позже начала", { endsAt: "Позже даты начала" });
  if (d.maxRoleLevel != null && d.maxRoleLevel < d.minRoleLevel)
    throw new UserError("Верхняя граница аудитории ниже нижней", { maxRoleLevel: "Должна быть не ниже «Кому»" });

  const data = {
    title: d.title,
    description: d.description ?? null,
    isActive: d.isActive,
    questions: d.questions as unknown as Prisma.InputJsonValue,
    minRoleLevel: d.minRoleLevel,
    maxRoleLevel: d.maxRoleLevel ?? null,
    startsAt,
    endsAt: d.endsAt ?? null,
    periodDays,
    dueDays: d.dueDays,
    enforcement: d.enforcement,
    notifyOnStart: d.notifyOnStart,
    remindBeforeHours: d.remindBeforeHours ?? null,
    notifyOverdue: d.notifyOverdue,
    staffDigest: d.staffDigest,
    anonymous,
    // Изменить анонимный ответ нельзя: его не с чем связать.
    allowEdit: anonymous ? false : d.allowEdit,
    retentionDays: d.retentionDays,
  };

  let id = d.id;
  if (!id) {
    id = (await db.survey.create({ data: { ...data, createdById: user.id } })).id;
    await audit({ actorId: user.id, action: "survey.create", entity: "Survey", entityId: id, ipAddress: ip });
  } else {
    await db.survey.update({ where: { id }, data });
    await audit({ actorId: user.id, action: "survey.update", entity: "Survey", entityId: id, ipAddress: ip, metadata: { isActive: d.isActive } });
  }
  revalidatePath("/admin/surveys");
  redirect(`/admin/surveys/${id}?saved=1`);
});

/** Черновик из шаблона: старт — ближайший понедельник 10:00 МСК, неактивна до проверки. */
export const createSurveyFromTemplate = userAction({ permission: P, schema: z.object({ key: z.string().max(40) }) }, async (d, { user, ip }) => {
  const t = SURVEY_TEMPLATES.find((x) => x.key === d.key);
  if (!t) throw new UserError("Шаблон не найден");
  const now = new Date();
  const msk = new Date(now.getTime() + 3 * 3_600_000);
  const daysToMonday = (8 - msk.getUTCDay()) % 7 || 7;
  const startsAt = new Date(Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate() + daysToMonday, 7, 0));
  const s = await db.survey.create({
    data: {
      title: t.title,
      description: t.description,
      questions: t.questions as unknown as Prisma.InputJsonValue,
      anonymous: t.anonymous,
      startsAt,
      periodDays: 14,
      dueDays: 3,
      createdById: user.id,
    },
  });
  await audit({ actorId: user.id, action: "survey.create", entity: "Survey", entityId: s.id, ipAddress: ip, metadata: { template: t.key } });
  redirect(`/admin/surveys/${s.id}`);
});

export const duplicateSurvey = userAction({ permission: P, schema: z.object({ id: zf.id() }) }, async (d, { user, ip }) => {
  const s = await db.survey.findUnique({ where: { id: d.id } });
  if (!s) throw new UserError("Форма не найдена");
  const { id: _id, createdAt: _c, updatedAt: _u, createdById: _cb, questions, ...rest } = s;
  const copy = await db.survey.create({
    data: { ...rest, questions: questions as Prisma.InputJsonValue, title: `${s.title} (копия)`, isActive: false, createdById: user.id },
  });
  await audit({ actorId: user.id, action: "survey.create", entity: "Survey", entityId: copy.id, ipAddress: ip, metadata: { copyOf: s.id } });
  redirect(`/admin/surveys/${copy.id}`);
});

export const deleteSurvey = userAction({ permission: P, schema: z.object({ id: zf.id() }) }, async (d, { user, ip }) => {
  const s = await db.survey.findUnique({ where: { id: d.id }, include: { _count: { select: { responses: true } } } });
  if (!s) throw new UserError("Форма не найдена");
  await db.survey.delete({ where: { id: d.id } });
  await audit({ actorId: user.id, action: "survey.delete", entity: "Survey", entityId: d.id, ipAddress: ip, metadata: { title: s.title, responses: s._count.responses } });
  revalidatePath("/admin/surveys");
  redirect("/admin/surveys");
});

export const remindPending = userAction({ permission: "surveys.results", schema: z.object({ id: zf.id() }) }, async (d, { user, ip }) => {
  const limit = await rateLimit(`survey-remind:${d.id}`, 1, 3600);
  if (!limit.ok) throw new UserError("Напоминание уже отправляли в последний час");
  const s = await db.survey.findUnique({ where: { id: d.id } });
  if (!s || !s.isActive) throw new UserError("Форма не активна");
  const period = currentSurveyPeriodFor(s);
  if (!period) throw new UserError("Сейчас нет открытого периода");
  const ids = await pendingSurveyUsers(s, period.index);
  const sent = await notify({
    userIds: ids,
    type: "SURVEY_DUE",
    title: `Напоминание: «${s.title}»`,
    body: new Date() >= period.dueAt ? "Срок прошёл — пройди форму как можно скорее." : `Срок — до ${formatDateTime(period.dueAt)}.`,
    url: `/cabinet/surveys/${s.id}`,
  });
  await audit({ actorId: user.id, action: "survey.remind", entity: "Survey", entityId: s.id, ipAddress: ip, metadata: { sent } });
  return { ok: true, message: `Напоминание отправлено: ${sent}` };
});
