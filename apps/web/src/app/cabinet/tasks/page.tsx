import type { Metadata } from "next";
import Link from "next/link";
import { ListTodo } from "lucide-react";
import { db } from "@drago/database";
import { DueLabel, TaskStatusBadge } from "@/components/cabinet/items";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Задачи" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requireUser();
  const { show } = await searchParams;
  const archived = show === "done";
  const tasks = await db.task.findMany({
    where: {
      assignees: { some: { userId: user.id } },
      status: archived ? { in: ["DONE", "CANCELLED"] } : { in: ["NEW", "IN_PROGRESS"] },
    },
    orderBy: archived ? [{ updatedAt: "desc" }] : [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 100,
    include: { _count: { select: { comments: true } } },
  });
  return (
    <>
      <PageHeader
        title="Мои задачи"
        actions={
          <>
            <ButtonLink href="/cabinet/tasks" variant={archived ? "ghost" : "secondary"} size="sm">
              Открытые
            </ButtonLink>
            <ButtonLink href="/cabinet/tasks?show=done" variant={archived ? "secondary" : "ghost"} size="sm">
              Завершённые
            </ButtonLink>
            {user.can("tasks.manage") && (
              <ButtonLink href="/admin/tasks/new" size="sm">
                Поставить задачу
              </ButtonLink>
            )}
          </>
        }
      />
      {tasks.length === 0 ? (
        <EmptyState title={archived ? "Завершённых задач нет" : "Открытых задач нет"} icon={<ListTodo className="size-8" />} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link href={`/cabinet/tasks/${t.id}`} className="flex flex-col gap-2 p-4 hover:bg-paper sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <p className="font-semibold">{t.title}</p>
                  <p className="mt-0.5 text-sm">
                    <DueLabel dueAt={t.dueAt} done={t.status === "DONE"} />
                    {t._count.comments > 0 && <span className="text-muted"> · комментариев: {t._count.comments}</span>}
                  </p>
                </div>
                <TaskStatusBadge status={t.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
