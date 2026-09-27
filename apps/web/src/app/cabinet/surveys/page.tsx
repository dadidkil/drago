import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { surveysForUser } from "@drago/core";
import { formatDateTime } from "@drago/shared";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Формы" };

export default async function CabinetSurveys({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const user = await requireUser("/cabinet/surveys");
  const { done } = await searchParams;
  const list = await surveysForUser({ id: user.id, roleLevel: user.level });
  const order = { overdue: 0, pending: 1, done: 2 } as const;
  list.sort((a, b) => order[a.status] - order[b.status] || a.period.dueAt.getTime() - b.period.dueAt.getTime());

  return (
    <>
      <PageHeader title="Формы" description="Регулярные формы отряда: самочувствие, обратная связь, опросы. Обязательные нужно пройти до срока." />
      {done && (
        <p className="mb-5 flex items-center gap-2 rounded-xl bg-[#e7f5ec] px-4 py-3 text-sm text-success">
          <CircleCheck className="size-4" aria-hidden /> Спасибо! Ответы сохранены.
        </p>
      )}
      {list.length === 0 ? (
        <EmptyState title="Сейчас форм нет">Когда появится новая форма, придёт уведомление.</EmptyState>
      ) : (
        <ul className="grid gap-3">
          {list.map(({ survey, period, status, completedAt }) => (
            <li key={survey.id}>
              <Link
                href={`/cabinet/surveys/${survey.id}`}
                className={`flex flex-col gap-2 rounded-2xl border bg-white p-5 transition-colors hover:border-fire/50 sm:flex-row sm:items-center sm:justify-between ${status === "overdue" ? "border-danger/40" : "border-line"}`}
              >
                <div>
                  <p className="font-semibold">{survey.title}</p>
                  <p className="mt-1 text-sm text-muted">
                    {status === "done"
                      ? `Пройдено ${formatDateTime(completedAt!)}${period.end ? ` · следующая — ${formatDateTime(period.end)}` : ""}`
                      : `Пройти до ${formatDateTime(period.dueAt)}`}
                    {survey.anonymous ? " · анонимно" : ""}
                  </p>
                </div>
                {status === "done" ? (
                  <Badge tone="success">пройдено</Badge>
                ) : status === "overdue" ? (
                  <Badge tone="danger">просрочено</Badge>
                ) : (
                  <Badge tone="fire">нужно пройти</Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
