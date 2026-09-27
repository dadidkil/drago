import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@drago/database";
import { currentSurveyPeriodFor, surveyAudienceWhere, surveyQuestions, surveySchedule } from "@drago/core";
import {
  formatDate,
  formatDateTime,
  formatSurveyAnswer,
  fullName,
  lastSurveyPeriodIndex,
  surveyPeriodByIndex,
  yesNoLabel,
  type SurveyAnswers,
  type SurveyQuestion,
} from "@drago/shared";
import { InlineAction } from "@/components/ui/form";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { remindPending } from "../../actions";

export const metadata: Metadata = { title: "Результаты формы" };

type Row = { answers: SurveyAnswers; name: string | null; flagged: boolean };

export default async function SurveyResults({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string }> }) {
  await requireAdmin("surveys.results");
  const { id } = await params;
  const sp = await searchParams;
  const s = await db.survey.findUnique({ where: { id } });
  if (!s) notFound();
  const schedule = surveySchedule(s);
  const last = lastSurveyPeriodIndex(schedule);
  const questions = surveyQuestions(s);

  if (last < 0) {
    return (
      <>
        <PageHeader title={`Результаты: ${s.title}`} />
        <EmptyState title="Форма ещё не началась">Первый период — с {formatDateTime(s.startsAt)}.</EmptyState>
      </>
    );
  }

  const idx = Math.min(last, Math.max(0, Number.isFinite(Number(sp.period)) && sp.period !== undefined ? Number(sp.period) : last));
  const period = surveyPeriodByIndex(schedule, idx);
  const current = s.isActive ? currentSurveyPeriodFor(s) : null;
  const trendFrom = Math.max(0, last - 7);

  const [audience, completions, responses, trendResponses] = await Promise.all([
    db.user.findMany({ where: surveyAudienceWhere(s), select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } }),
    db.surveyCompletion.findMany({
      where: { surveyId: s.id, period: idx },
      orderBy: { completedAt: "asc" },
      select: { userId: true, completedAt: true, user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } } },
    }),
    db.surveyResponse.findMany({
      where: { surveyId: s.id, period: idx },
      orderBy: { createdAt: "asc" },
      select: { answers: true, flagged: true, updatedAt: true, user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } } },
    }),
    db.surveyResponse.findMany({ where: { surveyId: s.id, period: { gte: trendFrom } }, select: { period: true, answers: true } }),
  ]);

  const nameOf = (u: { email: string; profile: { firstName: string; lastName: string } | null }) => (u.profile ? fullName(u.profile) : u.email);
  const doneIds = new Set(completions.map((c) => c.userId));
  const notDone = audience.filter((u) => !doneIds.has(u.id)).map(nameOf).sort((a, b) => a.localeCompare(b, "ru"));
  const rows: Row[] = responses.map((r) => ({ answers: r.answers as SurveyAnswers, name: r.user ? nameOf(r.user) : null, flagged: r.flagged }));
  // Анонимные ответы — в случайном порядке, чтобы порядок не выдавал, кто отвечал.
  if (s.anonymous) rows.sort(() => Math.random() - 0.5);
  const flagged = rows.filter((r) => r.flagged).length;
  const periods = Array.from({ length: last + 1 }, (_, i) => last - i).slice(0, 52);
  const numeric = questions.filter((q) => q.type === "SCALE" || q.type === "NUMBER");

  return (
    <>
      <PageHeader
        eyebrow="Результаты"
        title={s.title}
        description={
          <>
            Период {idx + 1}: {formatDate(period.start)} — {period.end ? formatDate(new Date(period.end.getTime() - 1)) : "без окончания"}, срок до{" "}
            {formatDateTime(period.dueAt)}. {s.anonymous ? "Анонимная форма: видно, кто прошёл, но не чьи ответы." : ""}
          </>
        }
        actions={
          <>
            <Link href={`/admin/surveys/${s.id}`} className="inline-flex h-9 items-center rounded-xl border border-line bg-white px-3 text-sm font-semibold">
              Настройки
            </Link>
            <a href={`/admin/surveys/${s.id}/export?period=${idx}`} className="inline-flex h-9 items-center rounded-xl border border-line bg-white px-3 text-sm font-semibold">
              CSV за период
            </a>
            <a href={`/admin/surveys/${s.id}/export?all=1`} className="inline-flex h-9 items-center rounded-xl border border-line bg-white px-3 text-sm font-semibold">
              CSV за всё время
            </a>
            {current && current.index === idx && notDone.length > 0 && (
              <InlineAction action={remindPending} fields={{ id: s.id }} label="Напомнить не прошедшим" variant="secondary" />
            )}
          </>
        }
      />

      <form method="get" className="mb-6 flex flex-wrap items-center gap-2">
        <label htmlFor="period" className="text-sm font-medium">
          Период
        </label>
        <select id="period" name="period" defaultValue={idx} className="rounded-xl border border-line bg-white px-3 py-2 text-sm">
          {periods.map((p) => {
            const pp = surveyPeriodByIndex(schedule, p);
            return (
              <option key={p} value={p}>
                {p + 1}: с {formatDate(pp.start)}
                {current?.index === p ? " (текущий)" : ""}
              </option>
            );
          })}
        </select>
        <button type="submit" className="h-9 rounded-xl bg-ink px-3 text-sm font-semibold text-paper">
          Показать
        </button>
      </form>

      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <Stat label="Аудитория сейчас" value={audience.length} />
        <Stat label="Прошли" value={completions.length} hint={audience.length ? `${Math.round((100 * Math.min(completions.length, audience.length)) / audience.length)}%` : undefined} />
        <Stat label="Не прошли" value={notDone.length} />
        <Stat label="Требуют внимания" value={flagged} hint="Сработали сигналы" />
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Не прошли ({notDone.length})</h2>
          {notDone.length ? <p className="text-sm leading-relaxed">{notDone.join(", ")}</p> : <p className="text-sm text-muted">Все прошли 🎉</p>}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Прошли ({completions.length})</h2>
          <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {completions.map((c) => (
              <li key={c.userId} className="flex justify-between gap-3">
                <span>{nameOf(c.user)}</span>
                <span className="text-muted">{formatDateTime(c.completedAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Ответы по вопросам</h2>
      {rows.length === 0 ? (
        <EmptyState title="В этом периоде ответов нет" />
      ) : (
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          {questions.map((q) => (
            <Card key={q.id}>
              <p className="font-semibold">{q.label}</p>
              <QuestionSummary q={q} rows={rows} anonymous={s.anonymous} />
            </Card>
          ))}
        </div>
      )}

      {numeric.length > 0 && last > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold">Динамика средних</h2>
          <div className="mb-8 overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-paper text-xs text-muted uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Вопрос</th>
                  {Array.from({ length: last - trendFrom + 1 }, (_, i) => trendFrom + i).map((p) => (
                    <th key={p} className="px-3 py-2 text-right">
                      {formatDate(surveyPeriodByIndex(schedule, p).start).slice(0, 5)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {numeric.map((q) => (
                  <tr key={q.id}>
                    <td className="px-4 py-2">{q.label}</td>
                    {Array.from({ length: last - trendFrom + 1 }, (_, i) => trendFrom + i).map((p) => {
                      const vals = trendResponses.filter((r) => r.period === p).map((r) => (r.answers as SurveyAnswers)[q.id]).filter((v): v is number => typeof v === "number");
                      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                      return (
                        <td key={p} className="px-3 py-2 text-right tabular-nums">
                          {avg === null ? "—" : avg.toFixed(1)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!s.anonymous && rows.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold">Ответы по людям</h2>
          <div className="grid gap-3">
            {rows
              .slice()
              .sort((a, b) => Number(b.flagged) - Number(a.flagged))
              .map((r, i) => (
                <details key={i} className={`rounded-2xl border bg-white px-5 py-3 ${r.flagged ? "border-danger/40" : "border-line"}`}>
                  <summary className="flex cursor-pointer items-center gap-2 font-semibold">
                    {r.name}
                    {r.flagged && <Badge tone="danger">требует внимания</Badge>}
                  </summary>
                  <dl className="mt-3 grid gap-2 text-sm">
                    {questions
                      .filter((q) => r.answers[q.id] !== undefined)
                      .map((q) => (
                        <div key={q.id} className="grid gap-1 sm:grid-cols-[1fr_1.2fr]">
                          <dt className="text-muted">{q.label}</dt>
                          <dd className="whitespace-pre-line">{formatSurveyAnswer(q, r.answers[q.id])}</dd>
                        </div>
                      ))}
                  </dl>
                </details>
              ))}
          </div>
        </>
      )}
    </>
  );
}

function Bar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total ? Math.round((100 * count) / total) : 0;
  return (
    <div className="text-sm">
      <div className="flex justify-between gap-3">
        <span>{label}</span>
        <span className="text-muted tabular-nums">
          {count} · {pct}%
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-paper-2">
        <div className="h-2 rounded-full bg-fire" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function QuestionSummary({ q, rows, anonymous }: { q: SurveyQuestion; rows: Row[]; anonymous: boolean }) {
  const answered = rows.filter((r) => r.answers[q.id] !== undefined);
  const n = answered.length;
  if (n === 0) return <p className="mt-2 text-sm text-muted">Нет ответов</p>;

  if (q.type === "SCALE" || q.type === "NUMBER") {
    const vals = answered.map((r) => Number(r.answers[q.id]));
    const avg = vals.reduce((a, b) => a + b, 0) / n;
    return (
      <div className="mt-3 grid gap-2">
        <p className="text-sm">
          Среднее: <b>{avg.toFixed(1)}</b>
          {q.type === "NUMBER" && ` · мин. ${Math.min(...vals)} · макс. ${Math.max(...vals)}`} · ответов: {n}
        </p>
        {q.type === "SCALE" &&
          q.scale &&
          Array.from({ length: q.scale.max - q.scale.min + 1 }, (_, i) => q.scale!.max - i).map((v) => (
            <Bar
              key={v}
              label={`${v}${v === q.scale!.max && q.scale!.maxLabel ? ` — ${q.scale!.maxLabel}` : ""}${v === q.scale!.min && q.scale!.minLabel ? ` — ${q.scale!.minLabel}` : ""}`}
              count={vals.filter((x) => x === v).length}
              total={n}
            />
          ))}
      </div>
    );
  }
  if (q.type === "SINGLE" || q.type === "MULTI" || q.type === "YES_NO") {
    const opts = q.type === "YES_NO" ? ["yes", "no"] : (q.options ?? []);
    return (
      <div className="mt-3 grid gap-2">
        {opts.map((o) => (
          <Bar
            key={o}
            label={q.type === "YES_NO" ? yesNoLabel(o) : o}
            count={answered.filter((r) => {
              const v = r.answers[q.id];
              return Array.isArray(v) ? v.includes(o) : v === o;
            }).length}
            total={n}
          />
        ))}
        {q.type === "MULTI" && <p className="text-xs text-muted">Можно было выбрать несколько — проценты от {n} ответивших.</p>}
      </div>
    );
  }
  return (
    <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm">
      {answered.map((r, i) => (
        <li key={i} className="rounded-lg bg-paper px-3 py-2 whitespace-pre-line">
          {!anonymous && r.name && <span className="block text-xs text-muted">{r.name}</span>}
          {String(r.answers[q.id])}
        </li>
      ))}
    </ul>
  );
}
