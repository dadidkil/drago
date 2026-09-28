import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ClipboardCheck, ListTodo } from "lucide-react";
import { db } from "@drago/database";
import { myOpenTasks, submissionsToReview } from "@drago/core";
import { formatDateTime, fullName } from "@drago/shared";
import { AssigneeBadge, DueLabel, TaskStatusBadge } from "@/components/cabinet/items";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Задачи" };

type Tab = "mine" | "review" | "created" | "done";

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const actor = { id: user.id, level: user.level, canManage: user.can("tasks.manage") };
  const [mine, review, createdCount] = await Promise.all([
    myOpenTasks(user.id, 100),
    submissionsToReview(actor, 100),
    db.task.count({ where: { createdById: user.id } }),
  ]);
  const canSet = user.can("tasks.manage") || createdCount > 0;
  const tab: Tab = (["mine", "review", "created", "done"] as const).includes(sp.show as Tab) ? (sp.show as Tab) : review.length > 0 && mine.length === 0 ? "review" : "mine";

  const tabs: { key: Tab; label: string; count?: number; show: boolean }[] = [
    { key: "mine", label: "Мне", count: mine.filter((t) => t.myStatus !== "SUBMITTED").length, show: true },
    { key: "review", label: "На проверку", count: review.length, show: canSet || review.length > 0 },
    { key: "created", label: "Поставленные мной", show: canSet },
    { key: "done", label: "Выполненные", show: true },
  ];

  return (
    <>
      <PageHeader
        title="Задачи"
        description="Сделали — нажмите «Сдать». Задача станет выполненной, когда её примет тот, кто поставил."
        actions={
          user.can("tasks.manage") ? (
            <ButtonLink href="/admin/tasks/new" size="sm">
              Поставить задачу
            </ButtonLink>
          ) : undefined
        }
      />
      <nav aria-label="Разделы задач" className="mb-5 flex flex-wrap gap-2">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <Link
              key={t.key}
              href={`/cabinet/tasks?show=${t.key}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${tab === t.key ? "bg-ink text-paper" : "bg-white hover:bg-paper-2"}`}
            >
              {t.label}
              {t.count ? <span className={`ml-1.5 rounded-full px-1.5 text-xs ${tab === t.key ? "bg-white/20" : "bg-fire text-white"}`}>{t.count}</span> : null}
            </Link>
          ))}
      </nav>

      {tab === "mine" && <MineList tasks={mine} />}
      {tab === "review" && <ReviewList items={review} />}
      {tab === "created" && <CreatedList userId={user.id} />}
      {tab === "done" && <DoneList userId={user.id} />}
    </>
  );
}

function Row({ href, title, meta, badge }: { href: string; title: string; meta: ReactNode; badge: ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex flex-col gap-2 p-4 hover:bg-paper sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-sm">{meta}</p>
        </div>
        <div className="shrink-0">{badge}</div>
      </Link>
    </li>
  );
}

const listCls = "divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white";

function MineList({ tasks }: { tasks: Awaited<ReturnType<typeof myOpenTasks>> }) {
  if (tasks.length === 0) return <EmptyState title="Открытых задач нет" icon={<ListTodo className="size-8" />}>Новые задачи появятся здесь и придут уведомлением.</EmptyState>;
  return (
    <ul className={listCls}>
      {tasks.map((t) => (
        <Row key={t.id} href={`/cabinet/tasks/${t.id}`} title={t.title} meta={<DueLabel dueAt={t.dueAt} />} badge={<AssigneeBadge status={t.myStatus} />} />
      ))}
    </ul>
  );
}

function ReviewList({ items }: { items: Awaited<ReturnType<typeof submissionsToReview>> }) {
  if (items.length === 0) return <EmptyState title="Проверять нечего" icon={<ClipboardCheck className="size-8" />}>Когда кто-то сдаст вашу задачу, она появится здесь.</EmptyState>;
  return (
    <ul className={listCls}>
      {items.map((r) => (
        <Row
          key={`${r.taskId}-${r.userId}`}
          href={`/cabinet/tasks/${r.taskId}`}
          title={r.task.title}
          meta={
            <span className="text-muted">
              {r.user.profile ? fullName(r.user.profile) : r.user.email} · сдано {r.submittedAt ? formatDateTime(r.submittedAt) : ""}
            </span>
          }
          badge={<AssigneeBadge status="SUBMITTED" />}
        />
      ))}
    </ul>
  );
}

async function CreatedList({ userId }: { userId: string }) {
  const tasks = await db.task.findMany({
    where: { createdById: userId, status: { notIn: ["DONE", "CANCELLED"] } },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 100,
    include: { assignees: { select: { status: true } } },
  });
  if (tasks.length === 0) return <EmptyState title="Нет открытых задач, поставленных вами" icon={<ListTodo className="size-8" />} />;
  return (
    <ul className={listCls}>
      {tasks.map((t) => {
        const acc = t.assignees.filter((a) => a.status === "ACCEPTED").length;
        const sub = t.assignees.filter((a) => a.status === "SUBMITTED").length;
        return (
          <Row
            key={t.id}
            href={`/cabinet/tasks/${t.id}`}
            title={t.title}
            meta={
              <>
                <DueLabel dueAt={t.dueAt} />
                <span className="text-muted">
                  {" "}
                  · принято {acc}/{t.assignees.length}
                  {sub ? ` · ждут проверки: ${sub}` : ""}
                </span>
              </>
            }
            badge={<TaskStatusBadge status={t.status} />}
          />
        );
      })}
    </ul>
  );
}

async function DoneList({ userId }: { userId: string }) {
  const rows = await db.taskAssignee.findMany({
    where: { userId, OR: [{ status: "ACCEPTED" }, { task: { status: "CANCELLED" } }] },
    orderBy: { reviewedAt: { sort: "desc", nulls: "last" } },
    take: 100,
    include: { task: { select: { id: true, title: true, status: true } } },
  });
  if (rows.length === 0) return <EmptyState title="Выполненных задач пока нет" icon={<ListTodo className="size-8" />} />;
  return (
    <ul className={listCls}>
      {rows.map((r) => (
        <Row
          key={r.taskId}
          href={`/cabinet/tasks/${r.taskId}`}
          title={r.task.title}
          meta={<span className="text-muted">{r.reviewedAt ? `принято ${formatDateTime(r.reviewedAt)}` : ""}</span>}
          badge={r.task.status === "CANCELLED" ? <TaskStatusBadge status="CANCELLED" /> : <AssigneeBadge status="ACCEPTED" />}
        />
      ))}
    </ul>
  );
}
