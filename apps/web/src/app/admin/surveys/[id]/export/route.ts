import { db } from "@drago/database";
import { audit, surveyQuestions, surveySchedule } from "@drago/core";
import { formatDate, formatDateTime, formatSurveyAnswer, fullName, surveyPeriodByIndex, type SurveyAnswers } from "@drago/shared";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getClientIp } from "@/lib/request";

/** CSV для Excel (UTF-8 с BOM, разделитель «;»). В анонимной форме — без имён. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!user.can("admin.access") || !user.can("surveys.results")) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return new Response("Not found", { status: 404 });
  const s = await db.survey.findUnique({ where: { id } });
  if (!s) return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const all = url.searchParams.get("all") === "1";
  const period = Number(url.searchParams.get("period") ?? 0);
  const responses = await db.surveyResponse.findMany({
    where: { surveyId: s.id, ...(all ? {} : { period: Number.isInteger(period) ? period : 0 }) },
    orderBy: s.anonymous ? [{ period: "asc" }, { id: "asc" }] : [{ period: "asc" }, { createdAt: "asc" }],
    select: { period: true, answers: true, flagged: true, updatedAt: true, user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } } },
  });
  if (s.anonymous) responses.sort(() => Math.random() - 0.5);

  const questions = surveyQuestions(s);
  const schedule = surveySchedule(s);
  const cell = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const header = ["Период", ...(s.anonymous ? [] : ["Имя", "Время ответа"]), "Требует внимания", ...questions.map((q) => q.label)];
  const lines = [header.map(cell).join(";")];
  for (const r of responses) {
    const answers = r.answers as SurveyAnswers;
    lines.push(
      [
        `${r.period + 1} (${formatDate(surveyPeriodByIndex(schedule, r.period).start)})`,
        ...(s.anonymous ? [] : [r.user?.profile ? fullName(r.user.profile) : (r.user?.email ?? ""), formatDateTime(r.updatedAt)]),
        r.flagged ? "да" : "",
        ...questions.map((q) => (answers[q.id] === undefined ? "" : formatSurveyAnswer(q, answers[q.id]))),
      ]
        .map(cell)
        .join(";"),
    );
  }
  await audit({
    actorId: user.id,
    action: "survey.export",
    entity: "Survey",
    entityId: s.id,
    ipAddress: await getClientIp(),
    metadata: { period: all ? "all" : period, rows: responses.length },
  });
  const name = `survey-${s.id}-${all ? "all" : `p${period + 1}`}.csv`;
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
