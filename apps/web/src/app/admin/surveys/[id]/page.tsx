import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@drago/database";
import { currentSurveyPeriodFor, surveyQuestions } from "@drago/core";
import { formatDateTime } from "@drago/shared";
import { InlineAction } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { deleteSurvey, duplicateSurvey } from "../actions";
import { SurveyEditor } from "../editor";

export const metadata: Metadata = { title: "Форма" };

export default async function EditSurvey({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const user = await requireAdmin("surveys.manage");
  const { id } = await params;
  const { saved } = await searchParams;
  const s = await db.survey.findUnique({ where: { id }, include: { _count: { select: { completions: true, responses: true } } } });
  if (!s) notFound();
  const locked = s._count.completions > 0;
  const period = s.isActive ? currentSurveyPeriodFor(s) : null;

  return (
    <>
      <PageHeader
        title={s.title}
        description={
          <>
            {s.isActive ? (period ? `Идёт период ${period.index + 1}: срок до ${formatDateTime(period.dueAt)}.` : `Начнётся ${formatDateTime(s.startsAt)}.`) : "Черновик — бойцы форму не видят."}{" "}
            Ответов: {s._count.responses}.
          </>
        }
        actions={
          <>
            {user.can("surveys.results") && (
              <Link href={`/admin/surveys/${s.id}/results`} className="inline-flex h-9 items-center rounded-xl bg-ink px-3 text-sm font-semibold text-paper">
                Результаты
              </Link>
            )}
            <Link href={`/cabinet/surveys/${s.id}?preview=1`} className="inline-flex h-9 items-center rounded-xl border border-line bg-white px-3 text-sm font-semibold">
              Предпросмотр
            </Link>
            <InlineAction action={duplicateSurvey} fields={{ id: s.id }} label="Копировать" refresh={false} />
            <InlineAction
              action={deleteSurvey}
              fields={{ id: s.id }}
              label="Удалить"
              variant="danger"
              refresh={false}
              confirm={s._count.responses ? `Удалить форму и все ответы (${s._count.responses})? Это необратимо.` : "Удалить форму?"}
            />
          </>
        }
      />
      {saved && <p className="mb-4 rounded-xl bg-[#e7f5ec] px-4 py-3 text-sm text-success">Сохранено</p>}
      {locked && (
        <p className="mb-4 rounded-xl bg-[#fdf3e0] px-4 py-3 text-sm text-warning">
          По форме уже есть ответы: начало, периодичность и анонимность заблокированы, чтобы не перепутать периоды. Нужно другое расписание —
          «Копировать» и запустите копию. Удалённые вопросы пропадут из результатов.
        </p>
      )}
      <div className="max-w-4xl">
        <SurveyEditor
          locked={locked}
          survey={{
            id: s.id,
            title: s.title,
            description: s.description,
            isActive: s.isActive,
            questions: surveyQuestions(s),
            minRoleLevel: s.minRoleLevel,
            maxRoleLevel: s.maxRoleLevel,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
            periodDays: s.periodDays,
            dueDays: s.dueDays,
            enforcement: s.enforcement,
            notifyOnStart: s.notifyOnStart,
            remindBeforeHours: s.remindBeforeHours,
            notifyOverdue: s.notifyOverdue,
            staffDigest: s.staffDigest,
            anonymous: s.anonymous,
            allowEdit: s.allowEdit,
            retentionDays: s.retentionDays,
          }}
        />
      </div>
    </>
  );
}
