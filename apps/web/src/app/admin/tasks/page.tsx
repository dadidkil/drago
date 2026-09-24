import type { Metadata } from "next";
import Link from "next/link";
import { db, type TaskStatus } from "@drago/database";
import { TASK_STATUS_LABELS, fullName } from "@drago/shared";
import { Table, Td } from "@/components/admin/table";
import { DueLabel, TaskStatusBadge } from "@/components/cabinet/items";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Задачи" };

export default async function AdminTasks({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin("tasks.manage");
  const { status } = await searchParams;
  const st = status && status in TASK_STATUS_LABELS ? (status as TaskStatus) : undefined;
  const tasks = await db.task.findMany({
    where: st ? { status: st } : { status: { in: ["NEW", "IN_PROGRESS"] } },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 300,
    include: { assignees: { include: { user: { select: { profile: { select: { firstName: true, lastName: true } } } } } } },
  });
  return (
    <>
      <PageHeader title="Задачи" actions={<ButtonLink href="/admin/tasks/new">Поставить задачу</ButtonLink>} />
      <nav aria-label="Статусы" className="mb-5 flex flex-wrap gap-2">
        <Link href="/admin/tasks" className={`rounded-full px-3 py-1.5 text-sm font-medium ${!st ? "bg-ink text-paper" : "bg-white"}`}>
          Открытые
        </Link>
        {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => (
          <Link key={k} href={`/admin/tasks?status=${k}`} className={`rounded-full px-3 py-1.5 text-sm font-medium ${st === k ? "bg-ink text-paper" : "bg-white"}`}>
            {v}
          </Link>
        ))}
      </nav>
      {tasks.length === 0 ? (
        <EmptyState title="Задач нет" />
      ) : (
        <Table headers={["Задача", "Исполнители", "Срок", "Статус"]}>
          {tasks.map((t) => (
            <tr key={t.id}>
              <Td>
                <Link href={`/admin/tasks/${t.id}`} className="font-semibold hover:text-fire">
                  {t.title}
                </Link>
              </Td>
              <Td className="text-muted">{t.assignees.map((a) => (a.user.profile ? fullName(a.user.profile) : "—")).join(", ")}</Td>
              <Td>
                <DueLabel dueAt={t.dueAt} done={t.status === "DONE"} />
              </Td>
              <Td>
                <TaskStatusBadge status={t.status} />
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
