import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@drago/database";
import { currentSurveyPeriodFor, surveyAudienceWhere, surveyQuestions } from "@drago/core";
import { SURVEY_ENFORCEMENT_LABELS, SURVEY_TEMPLATES, audienceLabel, describeSurveySchedule, formatDateTime } from "@drago/shared";
import { Table, Td } from "@/components/admin/table";
import { ButtonLink } from "@/components/ui/button";
import { InlineAction } from "@/components/ui/form";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/current-user";
import { createSurveyFromTemplate } from "./actions";

export const metadata: Metadata = { title: "Формы" };

export default async function AdminSurveys() {
  const user = await requireAdmin();
  if (!user.can("surveys.manage") && !user.can("surveys.results")) redirect("/forbidden");
  const canManage = user.can("surveys.manage");
  const surveys = await db.survey.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] });
  const now = new Date();
  const rows = await Promise.all(
    surveys.map(async (s) => {
      const period = s.isActive ? currentSurveyPeriodFor(s, now) : null;
      if (!period) return { s, period, done: 0, total: 0 };
      const [done, total] = await Promise.all([
        db.surveyCompletion.count({ where: { surveyId: s.id, period: period.index, user: surveyAudienceWhere(s) } }),
        db.user.count({ where: surveyAudienceWhere(s) }),
      ]);
      return { s, period, done, total };
    }),
  );

  return (
    <>
      <PageHeader
        title="Формы"
        description="Регулярные обязательные формы: самочувствие, обратная связь, опросы. Бойцы проходят их в личном кабинете по расписанию."
        actions={canManage ? <ButtonLink href="/admin/surveys/new">Новая форма</ButtonLink> : undefined}
      />
      {rows.length === 0 ? (
        <EmptyState title="Форм пока нет">Начните с шаблона ниже — его можно изменить перед запуском.</EmptyState>
      ) : (
        <Table headers={["Форма", "Кому", "Расписание", "Текущий период", ""]}>
          {rows.map(({ s, period, done, total }) => (
            <tr key={s.id}>
              <Td>
                {canManage ? (
                  <Link href={`/admin/surveys/${s.id}`} className="font-semibold hover:text-fire">
                    {s.title}
                  </Link>
                ) : (
                  <span className="font-semibold">{s.title}</span>
                )}
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {s.isActive ? <Badge tone="success">активна</Badge> : <Badge>черновик</Badge>}
                  {s.anonymous && <Badge tone="air">анонимно</Badge>}
                  <Badge tone={s.enforcement === "BLOCK" ? "danger" : s.enforcement === "BANNER" ? "warning" : "neutral"}>
                    {SURVEY_ENFORCEMENT_LABELS[s.enforcement].split(" ")[0]}
                  </Badge>
                  <span className="text-xs text-muted">{surveyQuestions(s).length} вопр.</span>
                </div>
              </Td>
              <Td className="text-muted">{audienceLabel(s.minRoleLevel)}</Td>
              <Td className="text-muted">{describeSurveySchedule(s)}</Td>
              <Td>
                {period ? (
                  <>
                    <span className="font-semibold">
                      {done} / {total}
                    </span>
                    <p className="text-xs text-muted">срок до {formatDateTime(period.dueAt)}</p>
                  </>
                ) : (
                  <span className="text-muted">{s.isActive ? `старт ${formatDateTime(s.startsAt)}` : "—"}</span>
                )}
              </Td>
              <Td>
                {user.can("surveys.results") && (
                  <Link href={`/admin/surveys/${s.id}/results`} className="font-semibold text-fire">
                    Результаты
                  </Link>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {canManage && (
        <>
      <h2 className="mt-10 mb-3 text-lg font-semibold">Шаблоны</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {SURVEY_TEMPLATES.map((t) => (
          <Card key={t.key} className="flex flex-col gap-3">
            <div>
              <p className="font-semibold">{t.title}</p>
              <p className="mt-1 text-sm text-muted">{t.description}</p>
              <p className="mt-2 text-xs text-muted">
                {t.questions.length} вопросов · {t.anonymous ? "анонимно" : "с именами"} · каждые 14 дней, срок 3 дня
              </p>
            </div>
            <div className="mt-auto">
              <InlineAction action={createSurveyFromTemplate} fields={{ key: t.key }} label="Создать черновик из шаблона" variant="secondary" refresh={false} />
            </div>
          </Card>
        ))}
      </div>
        </>
      )}
    </>
  );
}
