"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@drago/database";
import { audit, notify } from "@drago/core";
import { formatDateTime } from "@drago/shared";
import { userAction, UserError, zf } from "@/lib/actions";
import { storeUpload } from "@/lib/uploads";

const schema = z.object({
  id: zf.id().optional(),
  title: zf.str(3, 200, "Укажите название"),
  description: zf.optStr(10000),
  status: z.enum(["NEW", "IN_PROGRESS", "DONE", "CANCELLED"]).default("NEW"),
  dueAt: zf.optDateMsk(),
  assignees: zf.ids(),
  files: zf.files(),
});

export const saveTask = userAction({ permission: "tasks.manage", schema }, async (d, { user, ip }) => {
  if (d.assignees.length === 0) throw new UserError("Выберите хотя бы одного исполнителя", { assignees: "Выберите исполнителя" });
  const valid = (await db.user.findMany({ where: { id: { in: d.assignees }, status: "ACTIVE" }, select: { id: true } })).map((u) => u.id);
  const data = { title: d.title, description: d.description ?? null, status: d.status, dueAt: d.dueAt ?? null };

  let taskId = d.id;
  let newAssignees: string[] = valid;
  if (!taskId) {
    const task = await db.task.create({ data: { ...data, createdById: user.id, assignees: { create: valid.map((userId) => ({ userId })) } } });
    taskId = task.id;
    await audit({ actorId: user.id, action: "task.create", entity: "Task", entityId: taskId, ipAddress: ip, metadata: { assignees: valid.length } });
  } else {
    const before = await db.task.findUnique({ where: { id: taskId }, include: { assignees: true } });
    if (!before) throw new UserError("Задача не найдена");
    const prev = new Set(before.assignees.map((a) => a.userId));
    newAssignees = valid.filter((id) => !prev.has(id));
    const dueChanged = (before.dueAt?.getTime() ?? 0) !== (d.dueAt?.getTime() ?? 0);
    await db.$transaction([
      db.task.update({ where: { id: taskId }, data: { ...data, ...(dueChanged ? { reminderSentAt: null } : {}) } }),
      db.taskAssignee.deleteMany({ where: { taskId, userId: { notIn: valid } } }),
      db.taskAssignee.createMany({ data: newAssignees.map((userId) => ({ taskId: taskId!, userId })), skipDuplicates: true }),
    ]);
    await audit({ actorId: user.id, action: "task.update", entity: "Task", entityId: taskId, ipAddress: ip });
  }
  for (const file of d.files.filter((f) => f.size > 0).slice(0, 10)) {
    const asset = await storeUpload(file, { kind: "attachment", visibility: "INTERNAL", uploadedById: user.id });
    await db.fileAsset.update({ where: { id: asset.id }, data: { taskId } });
  }
  if (newAssignees.length > 0) {
    await notify({
      userIds: newAssignees,
      excludeUserId: user.id,
      type: "TASK_ASSIGNED",
      title: `Новая задача: ${d.title}`,
      body: d.dueAt ? `Срок: ${formatDateTime(d.dueAt)}` : "Без срока",
      url: `/cabinet/tasks/${taskId}`,
    });
  }
  revalidatePath("/admin/tasks");
  redirect(`/admin/tasks/${taskId}?saved=1`);
});

export const deleteTask = userAction({ permission: "tasks.manage", schema: z.object({ id: zf.id() }) }, async (d, { user, ip }) => {
  await db.task.delete({ where: { id: d.id } });
  await audit({ actorId: user.id, action: "task.delete", entity: "Task", entityId: d.id, ipAddress: ip });
  redirect("/admin/tasks");
});
