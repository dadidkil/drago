import { db, type AssigneeStatus, type TaskStatus } from "@drago/database";
import { OWNER_LEVEL, formatDateTime, truncate } from "@drago/shared";
import { createLogger } from "./logger";
import { notify, type NotificationAction } from "./notifications";
import { findUsersWithPermission } from "./permissions";

/**
 * Задачи отряда: одна логика для кабинета, админки и Telegram-бота.
 *
 * Жизненный цикл у каждого исполнителя свой:
 *   получена → в работе → сдана → (проверяет тот, кто поставил) → принята ✅ | на доработке ↩ → снова сдана…
 * Задача выполнена, когда её приняли у всех исполнителей. Сводный статус задачи считает recomputeTaskStatus.
 */

const log = createLogger("tasks");

export class TaskError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskError";
  }
}

/** Кто действует: id, имя для уведомлений, уровень (с учётом владельца) и право tasks.manage. */
export interface TaskActor {
  id: string;
  name: string;
  level: number;
  canManage: boolean;
}

const OPEN_FOR_ASSIGNEE: AssigneeStatus[] = ["ASSIGNED", "IN_PROGRESS", "RETURNED"];

/** Callback-данные кнопок бота (≤ 64 байт): tk:<операция>:<задача>[:<исполнитель>]. */
export const TASK_CALLBACK = {
  start: (taskId: string) => `tk:s:${taskId}`,
  submit: (taskId: string) => `tk:d:${taskId}`,
  accept: (taskId: string, userId: string) => `tk:a:${taskId}:${userId}`,
  ret: (taskId: string, userId: string) => `tk:r:${taskId}:${userId}`,
} as const;

export function assigneeActions(taskId: string, status: AssigneeStatus): NotificationAction[][] {
  const row: NotificationAction[] = [];
  if (status === "ASSIGNED" || status === "RETURNED") row.push({ text: "▶️ В работу", data: TASK_CALLBACK.start(taskId) });
  if (OPEN_FOR_ASSIGNEE.includes(status)) row.push({ text: "📤 Сдать", data: TASK_CALLBACK.submit(taskId) });
  return row.length ? [row] : [];
}

export function reviewActions(taskId: string, userId: string): NotificationAction[][] {
  return [[{ text: "✅ Принять", data: TASK_CALLBACK.accept(taskId, userId) }, { text: "↩️ На доработку", data: TASK_CALLBACK.ret(taskId, userId) }]];
}

/** Пересчитать сводный статус задачи по исполнителям (отменённую не трогаем). */
export async function recomputeTaskStatus(taskId: string): Promise<TaskStatus> {
  const task = await db.task.findUnique({ where: { id: taskId }, select: { status: true, completedAt: true, assignees: { select: { status: true } } } });
  if (!task) throw new TaskError("Задача не найдена");
  if (task.status === "CANCELLED") return task.status;
  const st = task.assignees.map((a) => a.status);
  let next: TaskStatus;
  if (st.length > 0 && st.every((s) => s === "ACCEPTED")) next = "DONE";
  else if (st.some((s) => s === "SUBMITTED")) next = "REVIEW";
  else if (st.some((s) => s !== "ASSIGNED")) next = "IN_PROGRESS";
  else next = "NEW";
  if (next !== task.status) {
    await db.task.update({ where: { id: taskId }, data: { status: next, completedAt: next === "DONE" ? new Date() : null } });
  }
  return next;
}

async function loadTask(taskId: string) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      assignees: { select: { userId: true, status: true } },
      createdBy: { select: { id: true, isOwner: true, role: { select: { level: true } } } },
    },
  });
  if (!task) throw new TaskError("Задача не найдена");
  return task;
}

type LoadedTask = Awaited<ReturnType<typeof loadTask>>;

/**
 * Принимает сдачу тот, кто поставил задачу. Если его нет (удалён) или он недоступен — командный состав
 * с правом tasks.manage уровнем не ниже автора (например, командир за методиста).
 */
export function canReview(task: Pick<LoadedTask, "createdById" | "createdBy">, actor: Pick<TaskActor, "id" | "level" | "canManage">): boolean {
  if (task.createdById === actor.id) return true;
  if (!actor.canManage) return false;
  const creatorLevel = task.createdBy ? (task.createdBy.isOwner ? OWNER_LEVEL : task.createdBy.role.level) : 0;
  return actor.level >= creatorLevel;
}

/** Кому уходит сдача на проверку: автору, а если автора нет — всем с правом tasks.manage. */
async function reviewerIds(task: LoadedTask): Promise<string[]> {
  if (task.createdById) return [task.createdById];
  return findUsersWithPermission("tasks.manage");
}

function myAssignment(task: LoadedTask, userId: string) {
  const a = task.assignees.find((x) => x.userId === userId);
  if (!a) throw new TaskError("Эта задача не назначена вам");
  if (task.status === "CANCELLED") throw new TaskError("Задача отменена");
  return a;
}

/** Исполнитель берёт задачу в работу. */
export async function startTask(taskId: string, actor: TaskActor): Promise<void> {
  const task = await loadTask(taskId);
  const a = myAssignment(task, actor.id);
  if (a.status === "IN_PROGRESS") return;
  if (!(a.status === "ASSIGNED" || a.status === "RETURNED")) throw new TaskError("Задача уже сдана");
  await db.$transaction([
    db.taskAssignee.update({ where: { taskId_userId: { taskId, userId: actor.id } }, data: { status: "IN_PROGRESS", startedAt: new Date() } }),
    db.taskComment.create({ data: { taskId, authorId: actor.id, kind: "STARTED", subjectUserId: actor.id, body: "Взял(а) в работу" } }),
  ]);
  await recomputeTaskStatus(taskId);
}

/** Исполнитель сдаёт задачу; поставившему уходит уведомление с кнопками «Принять / На доработку». */
export async function submitTask(taskId: string, actor: TaskActor, input: { note?: string; fileIds?: string[] } = {}): Promise<{ commentId: string }> {
  const task = await loadTask(taskId);
  const a = myAssignment(task, actor.id);
  if (a.status === "SUBMITTED") throw new TaskError("Задача уже сдана и ждёт проверки");
  if (a.status === "ACCEPTED") throw new TaskError("Задача уже принята");
  const note = input.note?.trim() || "";
  const [, comment] = await db.$transaction([
    db.taskAssignee.update({
      where: { taskId_userId: { taskId, userId: actor.id } },
      data: { status: "SUBMITTED", submittedAt: new Date(), startedAt: a.status === "ASSIGNED" ? new Date() : undefined },
    }),
    db.taskComment.create({ data: { taskId, authorId: actor.id, kind: "SUBMITTED", subjectUserId: actor.id, body: note || "Сдал(а) задачу" } }),
  ]);
  if (input.fileIds?.length) {
    await db.fileAsset.updateMany({ where: { id: { in: input.fileIds } }, data: { taskId, taskCommentId: comment.id } });
  }
  await recomputeTaskStatus(taskId);
  const reviewers = await reviewerIds(task);
  await notify({
    userIds: reviewers,
    type: "TASK_REVIEW",
    title: `Сдана задача: ${task.title}`,
    body: `${actor.name} сдал(а) задачу${note ? `: «${truncate(note, 300)}»` : ""}. Проверьте и примите или верните на доработку.`,
    url: `/cabinet/tasks/${taskId}`,
    actions: reviewActions(taskId, actor.id),
  });
  return { commentId: comment.id };
}

/** Проверка сдачи: принять (выполнено) или вернуть на доработку с пояснением. */
export async function reviewTask(taskId: string, assigneeId: string, actor: TaskActor, decision: "accept" | "return", note?: string): Promise<TaskStatus> {
  const task = await loadTask(taskId);
  if (!canReview(task, actor)) throw new TaskError("Принять задачу может только тот, кто её поставил");
  const a = task.assignees.find((x) => x.userId === assigneeId);
  if (!a) throw new TaskError("Исполнитель не найден");
  if (task.status === "CANCELLED") throw new TaskError("Задача отменена");
  if (decision === "accept" && a.status === "ACCEPTED") return task.status;
  if (decision === "return" && !note?.trim()) throw new TaskError("Напишите, что нужно доработать");
  if (decision === "return" && a.status !== "SUBMITTED" && a.status !== "ACCEPTED") throw new TaskError("Задача ещё не сдана");

  const text = note?.trim() || "";
  await db.$transaction([
    db.taskAssignee.update({
      where: { taskId_userId: { taskId, userId: assigneeId } },
      data: { status: decision === "accept" ? "ACCEPTED" : "RETURNED", reviewedAt: new Date(), reviewedById: actor.id },
    }),
    db.taskComment.create({
      data: {
        taskId,
        authorId: actor.id,
        kind: decision === "accept" ? "ACCEPTED" : "RETURNED",
        subjectUserId: assigneeId,
        body: text || (decision === "accept" ? "Принято" : "Вернул(а) на доработку"),
      },
    }),
  ]);
  const status = await recomputeTaskStatus(taskId);
  await notify({
    userIds: [assigneeId],
    type: "TASK_RESULT",
    title: decision === "accept" ? `Задача принята ✅ ${task.title}` : `На доработку: ${task.title}`,
    body:
      decision === "accept"
        ? `${actor.name} принял(а) задачу — она выполнена.${text ? ` «${truncate(text, 300)}»` : ""}`
        : `${actor.name}: «${truncate(text, 400)}». Доработайте и сдайте снова.`,
    url: `/cabinet/tasks/${taskId}`,
    actions: decision === "return" ? assigneeActions(taskId, "RETURNED") : undefined,
  });
  log.info("task reviewed", { taskId, assigneeId, decision, status });
  return status;
}

/** Уведомить новых исполнителей о задаче (в том числе себя, если поставил сам себе — это удобно как напоминание). */
export async function notifyTaskAssigned(task: { id: string; title: string; dueAt: Date | null }, userIds: string[], authorName: string): Promise<void> {
  if (userIds.length === 0) return;
  await notify({
    userIds,
    type: "TASK_ASSIGNED",
    title: `Новая задача: ${task.title}`,
    body: `${task.dueAt ? `Срок — ${formatDateTime(task.dueAt)}. ` : ""}Поставил(а): ${authorName}. Когда сделаете — нажмите «Сдать», ${authorName.split(" ")[0]} проверит.`,
    url: `/cabinet/tasks/${task.id}`,
    actions: assigneeActions(task.id, "ASSIGNED"),
  });
}

/** Мои открытые задачи с моим статусом (для кабинета, бота и дашборда). */
export async function myOpenTasks(userId: string, take = 20) {
  const rows = await db.taskAssignee.findMany({
    where: { userId, status: { not: "ACCEPTED" }, task: { status: { not: "CANCELLED" } } },
    include: { task: { select: { id: true, title: true, dueAt: true, status: true, createdAt: true } } },
    take: 200,
  });
  // Сначала то, что требует действий (новые и на доработке), затем в работе, затем сданные; внутри — по сроку.
  const rank: Record<AssigneeStatus, number> = { RETURNED: 0, ASSIGNED: 1, IN_PROGRESS: 2, SUBMITTED: 3, ACCEPTED: 4 };
  return rows
    .sort((a, b) => rank[a.status] - rank[b.status] || (a.task.dueAt?.getTime() ?? Infinity) - (b.task.dueAt?.getTime() ?? Infinity))
    .slice(0, take)
    .map((r) => ({ ...r.task, myStatus: r.status }));
}

/** Сдачи, которые ждут моей проверки. */
export async function submissionsToReview(actor: Pick<TaskActor, "id" | "level" | "canManage">, take = 50) {
  const rows = await db.taskAssignee.findMany({
    where: {
      status: "SUBMITTED",
      task: { status: { not: "CANCELLED" }, ...(actor.canManage ? {} : { createdById: actor.id }) },
    },
    orderBy: { submittedAt: "asc" },
    take: 300,
    include: {
      user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
      task: {
        select: {
          id: true,
          title: true,
          dueAt: true,
          createdById: true,
          createdBy: { select: { id: true, isOwner: true, role: { select: { level: true } } } },
        },
      },
    },
  });
  return rows.filter((r) => canReview(r.task, actor)).slice(0, take);
}
