import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@drago/database";
import { AttachmentList } from "@/components/cabinet/items";
import { InlineAction } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/misc";
import { activeUserOptions } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth/current-user";
import { deleteTask } from "../actions";
import { TaskForm } from "../form";

export const metadata: Metadata = { title: "Задача" };

export default async function EditTask({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin("tasks.manage");
  const { id } = await params;
  const { saved } = await searchParams;
  const task = await db.task.findUnique({
    where: { id },
    include: { assignees: { select: { userId: true } }, attachments: { select: { id: true, originalName: true, size: true } }, _count: { select: { comments: true } } },
  });
  if (!task) notFound();
  return (
    <>
      <Link href="/admin/tasks" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-fire">
        <ArrowLeft className="size-4" aria-hidden /> Задачи
      </Link>
      <PageHeader
        title={task.title}
        actions={
          <>
            <Link href={`/cabinet/tasks/${task.id}`} className="self-center text-sm font-semibold text-fire">
              Комментарии ({task._count.comments}) →
            </Link>
            <InlineAction action={deleteTask} fields={{ id: task.id }} label="Удалить" variant="danger" confirm="Удалить задачу?" />
          </>
        }
      />
      {saved && <p className="mb-4 rounded-xl bg-[#e7f5ec] px-4 py-3 text-sm text-success">Сохранено.</p>}
      <Card className="max-w-3xl">
        <TaskForm task={{ ...task, assigneeIds: task.assignees.map((a) => a.userId) }} users={await activeUserOptions()} />
        <AttachmentList files={task.attachments} />
      </Card>
    </>
  );
}
