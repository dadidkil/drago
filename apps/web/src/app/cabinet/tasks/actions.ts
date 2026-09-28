"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@drago/database";
import { audit, notify, reviewTask, startTask, submitTask, TaskError, type TaskActor } from "@drago/core";
import { fullName } from "@drago/shared";
import { userAction, UserError, zf } from "@/lib/actions";
import type { CurrentUser } from "@/lib/auth/current-user";
import { storeUpload } from "@/lib/uploads";

function actorOf(user: CurrentUser): TaskActor {
  return { id: user.id, name: user.profile ? fullName(user.profile) : user.email, level: user.level, canManage: user.can("tasks.manage") };
}

/** Ошибки доменной логики задач — пользователю, остальное — в лог. */
async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof TaskError) throw new UserError(err.message);
    throw err;
  }
}

function refresh(taskId: string) {
  revalidatePath(`/cabinet/tasks/${taskId}`);
  revalidatePath("/cabinet", "layout");
  revalidatePath("/admin/tasks");
}

export const startTaskAction = userAction({ schema: z.object({ taskId: zf.id() }) }, async (d, { user, ip }) => {
  await run(() => startTask(d.taskId, actorOf(user)));
  await audit({ actorId: user.id, action: "task.start", entity: "Task", entityId: d.taskId, ipAddress: ip });
  refresh(d.taskId);
  return { ok: true, message: "Задача в работе" };
});

export const submitTaskAction = userAction(
  { schema: z.object({ taskId: zf.id(), note: zf.optStr(2000), files: zf.files() }) },
  async (d, { user, ip }) => {
    const task = await db.task.findFirst({ where: { id: d.taskId, assignees: { some: { userId: user.id } } }, select: { id: true } });
    if (!task) throw new UserError("Задача не найдена");
    const fileIds: string[] = [];
    for (const file of d.files.filter((f) => f.size > 0).slice(0, 10)) {
      fileIds.push((await storeUpload(file, { kind: "attachment", visibility: "INTERNAL", uploadedById: user.id })).id);
    }
    await run(() => submitTask(d.taskId, actorOf(user), { note: d.note, fileIds }));
    await audit({ actorId: user.id, action: "task.submit", entity: "Task", entityId: d.taskId, ipAddress: ip, metadata: { files: fileIds.length } });
    refresh(d.taskId);
    return { ok: true, message: "Сдано! Ждёт проверки того, кто поставил задачу." };
  },
);

export const reviewTaskAction = userAction(
  {
    schema: z.object({ taskId: zf.id(), userId: zf.id(), decision: z.enum(["accept", "return"]), note: zf.optStr(2000) }),
  },
  async (d, { user, ip }) => {
    await run(() => reviewTask(d.taskId, d.userId, actorOf(user), d.decision, d.note));
    await audit({ actorId: user.id, action: `task.${d.decision}`, entity: "Task", entityId: d.taskId, ipAddress: ip, metadata: { assignee: d.userId } });
    refresh(d.taskId);
    return { ok: true, message: d.decision === "accept" ? "Принято" : "Возвращено на доработку" };
  },
);

/** Принять все сданные работы по задаче разом (например, «сдать справку» у двадцати бойцов). */
export const acceptAllSubmitted = userAction({ schema: z.object({ taskId: zf.id() }) }, async (d, { user, ip }) => {
  const submitted = await db.taskAssignee.findMany({ where: { taskId: d.taskId, status: "SUBMITTED" }, select: { userId: true } });
  if (submitted.length === 0) throw new UserError("Нет сданных работ");
  for (const s of submitted) await run(() => reviewTask(d.taskId, s.userId, actorOf(user), "accept"));
  await audit({ actorId: user.id, action: "task.accept_all", entity: "Task", entityId: d.taskId, ipAddress: ip, metadata: { count: submitted.length } });
  refresh(d.taskId);
  return { ok: true, message: `Принято: ${submitted.length}` };
});

export const addTaskComment = userAction(
  { schema: z.object({ taskId: zf.id(), body: zf.str(1, 2000, "Напишите комментарий"), files: zf.files() }) },
  async (d, { user }) => {
    const task = await db.task.findUnique({ where: { id: d.taskId }, include: { assignees: { select: { userId: true } } } });
    if (!task) throw new UserError("Задача не найдена");
    const isAssignee = task.assignees.some((a) => a.userId === user.id);
    if (!isAssignee && task.createdById !== user.id && !user.can("tasks.manage")) throw new UserError("Задача не найдена");
    const comment = await db.taskComment.create({ data: { taskId: task.id, authorId: user.id, body: d.body } });
    for (const file of d.files.filter((f) => f.size > 0).slice(0, 5)) {
      const asset = await storeUpload(file, { kind: "attachment", visibility: "INTERNAL", uploadedById: user.id });
      await db.fileAsset.update({ where: { id: asset.id }, data: { taskId: task.id, taskCommentId: comment.id } });
    }
    const recipients = [...task.assignees.map((a) => a.userId), ...(task.createdById ? [task.createdById] : [])];
    await notify({
      userIds: recipients,
      excludeUserId: user.id,
      type: "TASK_COMMENT",
      title: `Комментарий к задаче «${task.title}»`,
      body: `${user.profile ? fullName(user.profile) : user.email}: ${d.body.slice(0, 300)}`,
      url: `/cabinet/tasks/${task.id}`,
    });
    revalidatePath(`/cabinet/tasks/${task.id}`);
    return { ok: true, message: "Комментарий добавлен" };
  },
);
