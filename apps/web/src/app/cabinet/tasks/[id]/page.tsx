import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, MessageSquare, Play, Send, Undo2 } from "lucide-react";
import { db, type TaskEventKind } from "@drago/database";
import { canReview } from "@drago/core";
import { formatBytes, formatDateTime, fullName } from "@drago/shared";
import { AssigneeBadge, AttachmentList, DueLabel, TaskStatusBadge } from "@/components/cabinet/items";
import { Avatar, Card } from "@/components/ui/misc";
import { Markdown } from "@/components/ui/markdown";
import { requireUser } from "@/lib/auth/current-user";
import { fileUrl } from "@/lib/uploads";
import { AcceptAllButton, AssigneePanel, CommentForm, ReviewButtons } from "./task-forms";

export const metadata: Metadata = { title: "Задача" };

const EVENT_ICON: Record<TaskEventKind, typeof MessageSquare> = {
  COMMENT: MessageSquare,
  STARTED: Play,
  SUBMITTED: Send,
  ACCEPTED: CheckCircle2,
  RETURNED: Undo2,
};

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) notFound();
  const task = await db.task.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, email: true, isOwner: true, role: { select: { level: true } }, profile: true } },
      assignees: { orderBy: { assignedAt: "asc" }, include: { user: { select: { id: true, email: true, profile: true } } } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { email: true, profile: true } }, files: { select: { id: true, originalName: true, size: true } } },
      },
      attachments: { where: { taskCommentId: null }, select: { id: true, originalName: true, size: true } },
    },
  });
  if (!task) notFound();
  const mine = task.assignees.find((a) => a.userId === user.id);
  const reviewer = canReview(task, { id: user.id, level: user.level, canManage: user.can("tasks.manage") });
  if (!mine && !reviewer && !user.can("tasks.manage")) notFound();

  const nameOf = (u: { email: string; profile: { firstName: string; lastName: string } | null } | null) =>
    u?.profile ? fullName(u.profile) : (u?.email ?? "Удалённый пользователь");
  const accepted = task.assignees.filter((a) => a.status === "ACCEPTED").length;
  const submitted = task.assignees.filter((a) => a.status === "SUBMITTED");
  const lastOf = (userId: string, kind: TaskEventKind) => [...task.comments].reverse().find((c) => c.subjectUserId === userId && c.kind === kind);
  const myReturn = mine?.status === "RETURNED" ? lastOf(user.id, "RETURNED") : undefined;

  return (
    <div className="space-y-6">
      <Link href="/cabinet/tasks" className="inline-flex items-center gap-1 text-sm font-semibold text-fire">
        <ArrowLeft className="size-4" aria-hidden /> Задачи
      </Link>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <TaskStatusBadge status={task.status} />
          <span className="text-sm">
            <DueLabel dueAt={task.dueAt} done={task.status === "DONE"} />
          </span>
          {task.assignees.length > 1 && (
            <span className="text-sm text-muted">
              принято {accepted} из {task.assignees.length}
            </span>
          )}
        </div>
        <h1 className="mt-3 text-2xl font-semibold">{task.title}</h1>
        {task.description && <Markdown source={task.description} className="mt-3" />}
        <AttachmentList files={task.attachments} />
        <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
          Поставил(а): <span className="font-medium text-ink">{nameOf(task.createdBy)}</span>
          {" · "}
          {formatDateTime(task.createdAt)}. Сдайте задачу, когда сделаете, — её проверит поставивший, и после принятия она будет выполнена.
        </p>
        {user.can("tasks.manage") && (
          <Link href={`/admin/tasks/${task.id}`} className="mt-3 inline-block text-sm font-semibold text-fire">
            Изменить в админ-панели →
          </Link>
        )}
      </Card>

      {mine && task.status !== "CANCELLED" && (
        <Card className={mine.status === "RETURNED" ? "border-danger/40" : undefined}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Моё выполнение</h2>
            <AssigneeBadge status={mine.status} />
          </div>
          {mine.status === "SUBMITTED" && <p className="text-sm text-muted">Сдано {formatDateTime(mine.submittedAt!)}. Ждём проверки — придёт уведомление.</p>}
          {mine.status === "ACCEPTED" && <p className="text-sm text-success">Принято {mine.reviewedAt ? formatDateTime(mine.reviewedAt) : ""} — задача выполнена. Спасибо!</p>}
          {myReturn && (
            <p className="mb-3 rounded-xl bg-[#fdecea] px-4 py-3 text-sm text-danger">
              Вернули на доработку: «{myReturn.body}» — {nameOf(myReturn.author)}
            </p>
          )}
          <AssigneePanel taskId={task.id} status={mine.status} />
        </Card>
      )}

      {reviewer && task.assignees.length > 0 && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Исполнители и проверка</h2>
            {submitted.length > 1 && <AcceptAllButton taskId={task.id} count={submitted.length} />}
          </div>
          <ul className="divide-y divide-line">
            {task.assignees.map((a) => {
              const sub = a.status === "SUBMITTED" ? lastOf(a.userId, "SUBMITTED") : undefined;
              return (
                <li key={a.userId} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <Avatar name={nameOf(a.user)} src={a.user.profile?.avatarFileId ? fileUrl(a.user.profile.avatarFileId) : null} size={36} />
                    <div className="min-w-0">
                      <p className="font-medium">{nameOf(a.user)}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm">
                        <AssigneeBadge status={a.status} />
                        {a.submittedAt && a.status === "SUBMITTED" && <span className="text-muted">сдано {formatDateTime(a.submittedAt)}</span>}
                      </p>
                      {sub && (sub.body !== "Сдал(а) задачу" || sub.files.length > 0) && (
                        <div className="mt-2 rounded-xl bg-paper px-3 py-2 text-sm">
                          {sub.body !== "Сдал(а) задачу" && <p className="whitespace-pre-line">{sub.body}</p>}
                          <FileLinks files={sub.files} />
                        </div>
                      )}
                    </div>
                  </div>
                  {(a.status === "SUBMITTED" || a.status === "ACCEPTED") && task.status !== "CANCELLED" && (
                    <div className="shrink-0">{a.status === "SUBMITTED" ? <ReviewButtons taskId={task.id} userId={a.userId} /> : null}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <section aria-labelledby="timeline-title">
        <h2 id="timeline-title" className="mb-3 text-lg font-semibold">
          Лента задачи
        </h2>
        <ol className="space-y-3">
          {task.comments.map((c) => {
            const Icon = EVENT_ICON[c.kind];
            const author = nameOf(c.author);
            const event = c.kind !== "COMMENT";
            return (
              <li key={c.id} className={`flex gap-3 rounded-2xl border p-4 ${event ? "border-transparent bg-paper-2/60" : "border-line bg-white"}`}>
                {event ? (
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-muted">
                    <Icon className="size-4" aria-hidden />
                  </span>
                ) : (
                  <Avatar name={author} size={36} />
                )}
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold">{author}</span> <span className="text-muted">· {formatDateTime(c.createdAt)}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-line">
                    {c.kind === "SUBMITTED" && c.body === "Сдал(а) задачу" ? "Сдал(а) задачу на проверку" : c.body}
                  </p>
                  <FileLinks files={c.files} />
                </div>
              </li>
            );
          })}
        </ol>
        <div className="mt-3">
          <CommentForm taskId={task.id} />
        </div>
      </section>
    </div>
  );
}

function FileLinks({ files }: { files: { id: string; originalName: string; size: number }[] }) {
  if (files.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {files.map((f) => (
        <li key={f.id}>
          <a href={fileUrl(f.id)} className="inline-flex rounded-lg bg-white px-2.5 py-1 text-xs font-medium hover:text-fire" target="_blank" rel="noopener">
            📎 {f.originalName} · {formatBytes(f.size)}
          </a>
        </li>
      ))}
    </ul>
  );
}
