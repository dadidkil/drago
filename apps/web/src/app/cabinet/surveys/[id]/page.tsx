import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EyeOff, Lock } from "lucide-react";
import { db } from "@drago/database";
import { currentSurveyPeriodFor, inSurveyAudience, surveyQuestions } from "@drago/core";
import { formatDateTime, type SurveyAnswers } from "@drago/shared";
import { Markdown } from "@/components/ui/markdown";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";
import { SurveyForm } from "./survey-form";

export const metadata: Metadata = { title: "Форма" };

export default async function CabinetSurvey({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/cabinet/surveys/${id}`);
  const { preview } = await searchParams;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) notFound();
  const survey = await db.survey.findUnique({ where: { id } });
  if (!survey) notFound();

  // Предпросмотр — для тех, кто настраивает формы (в том числе черновики).
  const isPreview = preview === "1" && user.can("surveys.manage");
  if (!isPreview && (!survey.isActive || !inSurveyAudience(survey, user.level))) notFound();

  const questions = surveyQuestions(survey);
  const period = currentSurveyPeriodFor(survey);
  const completion =
    period && !isPreview
      ? await db.surveyCompletion.findUnique({ where: { surveyId_userId_period: { surveyId: survey.id, userId: user.id, period: period.index } } })
      : null;
  const canEdit = Boolean(completion) && survey.allowEdit && !survey.anonymous;
  const previous = canEdit
    ? await db.surveyResponse.findUnique({ where: { surveyId_userId_period: { surveyId: survey.id, userId: user.id, period: period!.index } }, select: { answers: true } })
    : null;
  const overdue = period ? new Date() >= period.dueAt : false;

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow={isPreview ? "Предпросмотр" : "Форма"}
        title={survey.title}
        description={
          period ? (
            <span className={overdue && !completion ? "font-semibold text-danger" : undefined}>
              {completion ? `Пройдено ${formatDateTime(completion.completedAt)}` : `${overdue ? "Срок прошёл" : "Пройти до"} ${formatDateTime(period.dueAt)}`}
            </span>
          ) : (
            "Сейчас форма не принимает ответы"
          )
        }
      />
      {survey.description && (
        <div className="mb-5 rounded-2xl border border-line bg-white p-5">
          <Markdown source={survey.description} />
        </div>
      )}
      <p className="mb-5 flex items-start gap-2 text-sm text-muted">
        {survey.anonymous ? <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />}
        {survey.anonymous
          ? "Анонимно: командный состав видит только то, что ты прошёл(а) форму, но не твои ответы."
          : "Ответы видит только руководство отряда с доступом к результатам форм (по умолчанию — командир и комиссар). Публично они не показываются."}
      </p>

      {!period && !isPreview ? (
        <EmptyState title="Форма сейчас закрыта" />
      ) : completion && !canEdit ? (
        <EmptyState title="Спасибо, форма пройдена">
          {period?.end ? `Следующая — ${formatDateTime(period.end)}.` : "Больше проходить не нужно."}{" "}
          <Link href="/cabinet/surveys" className="font-semibold text-fire">
            Все формы
          </Link>
        </EmptyState>
      ) : (
        <SurveyForm surveyId={survey.id} questions={questions} initial={(previous?.answers as SurveyAnswers | undefined) ?? undefined} preview={isPreview} />
      )}
    </div>
  );
}
