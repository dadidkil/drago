import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@drago/database";
import { formatDateTime, fullName } from "@drago/shared";
import { AttachmentList, DueLabel, TaskStatusBadge } from "@/components/cabinet/items";
import { Avatar, Card } from "@/components/ui/misc";
import { Markdown } from "@/components/ui/markdown";
import { requireUser } from "@/lib/auth/current-user";
import { CommentForm, StatusButtons } from "./task-forms";

export const metadata: Metadata = { title: "Задача" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const task = await db.task.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, profile: true } },
      assignees: { include: { user: { select: { id: true, profile: true } } } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { profile: true, email: true } } } },
      attachments: { select: { id: true, originalName: true, size: true } },
    },
  });
  if (!task) notFound();
  const isAssignee = task.assignees.some((a) => a.userId === user.id);
  const isManager = user.can("tasks.manage") || task.createdById === user.id;
  if (!isAssignee && !isManager) notFound();

  return (
    <div className="space-y-6">
      <Link href="/cabinet/tasks" className="inline-flex items-center gap-1 text-sm font-semibold text-fire">
        <ArrowLeft className="size-4" aria-hidden /> Мои задачи
      </Link>
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <TaskStatusBadge status={task.status} />
          <span className="text-sm">
            <DueLabel dueAt={task.dueAt} done={task.status === "DONE"} />
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold">{task.title}</h1>
        {task.description && <Markdown source={task.description} className="mt-3" />}
        <AttachmentList files={task.attachments} />
        <dl className="mt-5 grid gap-3 border-t border-line pt-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Поставил(а)</dt>
            <dd className="font-medium">{task.createdBy?.profile ? fullName(task.createdBy.profile) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Исполнители</dt>
            <dd className="font-medium">{task.assignees.map((a) => (a.user.profile ? fullName(a.user.profile) : "—")).join(", ") || "—"}</dd>
          </div>
        </dl>
        {(isAssignee || isManager) && task.status !== "CANCELLED" && (
          <div className="mt-5 border-t border-line pt-5">
            <StatusButtons taskId={task.id} current={task.status} />
          </div>
        )}
        {isManager && user.can("tasks.manage") && (
          <Link href={`/admin/tasks/${task.id}`} className="mt-4 inline-block text-sm font-semibold text-fire">
            Редактировать в админ-панели →
          </Link>
        )}
      </Card>

      <section aria-labelledby="comments-title">
        <h2 id="comments-title" className="mb-3 text-lg font-semibold">
          Комментарии
        </h2>
        <div className="space-y-3">
          {task.comments.map((c) => {
            const name = c.author?.profile ? fullName(c.author.profile) : "Удалённый пользователь";
            return (
              <div key={c.id} className="flex gap-3 rounded-2xl border border-line bg-white p-4">
                <Avatar name={name} size={36} />
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold">{name}</span> <span className="text-muted">· {formatDateTime(c.createdAt)}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-line">{c.body}</p>
                </div>
              </div>
            );
          })}
          <CommentForm taskId={task.id} />
        </div>
      </section>
    </div>
  );
}
