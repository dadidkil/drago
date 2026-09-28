-- Задачи: сдача → проверка поставившим → выполнено (статус у каждого исполнителя, лента событий, файлы к сдаче).
-- Почта: пароль ящика хранится зашифрованным и кабинет входит сам; воркер считает новые письма.
-- Уведомления: кнопки действий для Telegram.

-- CreateEnum
CREATE TYPE "AssigneeStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'RETURNED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "TaskEventKind" AS ENUM ('COMMENT', 'STARTED', 'SUBMITTED', 'ACCEPTED', 'RETURNED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'MAIL_NEW';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_REVIEW';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_RESULT';
ALTER TYPE "NotificationType" ADD VALUE 'DOCUMENT_NEW';
ALTER TYPE "NotificationType" ADD VALUE 'DIGEST';

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'REVIEW';

-- DropIndex
DROP INDEX "TaskAssignee_userId_idx";

-- AlterTable
ALTER TABLE "EmailAccount" ADD COLUMN     "lastUidNext" INTEGER,
ADD COLUMN     "mailCheckedAt" TIMESTAMP(3),
ADD COLUMN     "passwordEnc" TEXT,
ADD COLUMN     "unreadCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "FileAsset" ADD COLUMN     "taskCommentId" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "actions" JSONB;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "overdueNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TaskAssignee" ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "status" "AssigneeStatus" NOT NULL DEFAULT 'ASSIGNED',
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TaskComment" ADD COLUMN     "kind" "TaskEventKind" NOT NULL DEFAULT 'COMMENT',
ADD COLUMN     "subjectUserId" TEXT;

-- CreateIndex
CREATE INDEX "TaskAssignee_userId_status_idx" ON "TaskAssignee"("userId", "status");

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_taskCommentId_fkey" FOREIGN KEY ("taskCommentId") REFERENCES "TaskComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Перенос существующих задач на новую схему: статус исполнителя — из статуса задачи.
UPDATE "TaskAssignee" ta SET "status" = 'ACCEPTED', "reviewedAt" = t."updatedAt"
  FROM "Task" t WHERE t.id = ta."taskId" AND t.status = 'DONE';
UPDATE "TaskAssignee" ta SET "status" = 'IN_PROGRESS', "startedAt" = t."updatedAt"
  FROM "Task" t WHERE t.id = ta."taskId" AND t.status = 'IN_PROGRESS';
UPDATE "Task" SET "completedAt" = "updatedAt" WHERE status = 'DONE';
