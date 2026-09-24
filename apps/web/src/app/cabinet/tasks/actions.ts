"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@drago/database";
import { audit, notify } from "@drago/core";
import { fullName, TASK_STATUS_LABELS } from "@drago/shared";
import { userAction, UserError, zf } from "@/lib/actions";
import type { CurrentUser } from "@/lib/auth/current-user";
import { storeUpload } from "@/lib/uploads";

async function loadTaskForUser(taskId: string, user: CurrentUser) {
  const task = await db.task.findUnique({ where: { id: taskId }, include: { assignees: { select: { userId: true } } } });
  if (!task) throw new UserError("Задача не найдена");
  const isAssignee = task.assignees.some((a) => a.userId === user.id);
  const isManager = user.can("tasks.manage") || task.createdById === user.id;
  if (!isAssignee && !isManager) throw new UserError("Задача не найдена");
  return { task, isAssignee, isManager };
}

export const updateMyTaskStatus = userAction(
  { schema: z.object({ taskId: zf.id(), status: z.enum(["NEW", "IN_PROGRESS", "DONE"]) }) },
  async (d, { user, ip }) => {
    const { task, isManager } = await loadTaskForUser(d.taskId, user);
    if (task.status === "CANCELLED" && !isManager) throw new UserError("Задача отменена");
    await db.task.update({ where: { id: task.id }, data: { status: d.status } });
    await audit({ actorId: user.id, action: "task.status", entity: "Task", entityId: task.id, ipAddress: ip, metadata: { status: d.status } });
    if (task.createdById && task.createdById !== user.id) {
      await notify({
        userIds: [task.createdById],
        type: "TASK_COMMENT",
        title: `Статус задачи: ${TASK_STATUS_LABELS[d.status]}`,
        body: `${user.profile ? fullName(user.profile) : user.email}: «${task.title}»`,
        url: `/cabinet/tasks/${task.id}`,
      });
    }
    revalidatePath(`/cabinet/tasks/${task.id}`);
    return { ok: true, message: "Статус обновлён" };
  },
);

export const addTaskComment = userAction(
  { schema: z.object({ taskId: zf.id(), body: zf.str(1, 2000, "Напишите комментарий"), files: zf.files() }) },
  async (d, { user }) => {
    const { task } = await loadTaskForUser(d.taskId, user);
    await db.taskComment.create({ data: { taskId: task.id, authorId: user.id, body: d.body } });
    for (const file of d.files.filter((f) => f.size > 0).slice(0, 5)) {
      const asset = await storeUpload(file, { kind: "attachment", visibility: "INTERNAL", uploadedById: user.id });
      await db.fileAsset.update({ where: { id: asset.id }, data: { taskId: task.id } });
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
