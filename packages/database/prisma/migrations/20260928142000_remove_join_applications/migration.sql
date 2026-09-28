-- Приём анкет на сайте удалён: заявки в трудовые отряды принимает МосРСО в своём
-- приложении ВКонтакте, а внутренняя таблица оставалась пустой и только хранила ПДн-схему.

-- Уведомления о новых заявках больше не существуют как тип.
DELETE FROM "NotificationPreference" WHERE "type" = 'APPLICATION_NEW';
DELETE FROM "Notification" WHERE "type" = 'APPLICATION_NEW';

-- Значение из enum в Postgres убирается только пересозданием типа.
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
CREATE TYPE "NotificationType" AS ENUM ('ANNOUNCEMENT', 'TASK_ASSIGNED', 'TASK_DEADLINE', 'TASK_COMMENT', 'EVENT_CREATED', 'EVENT_UPDATED', 'EVENT_REMINDER', 'MAIL_READY', 'SURVEY_DUE', 'SURVEY_ALERT', 'SYSTEM');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType" USING "type"::text::"NotificationType";
ALTER TABLE "NotificationPreference" ALTER COLUMN "type" TYPE "NotificationType" USING "type"::text::"NotificationType";
DROP TYPE "NotificationType_old";

DROP TABLE "JoinApplication";
DROP TYPE "ApplicationStatus";
DROP TYPE "ApplicationSource";
