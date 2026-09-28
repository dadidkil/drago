-- Иерархия отряда: Кандидат → Боец → командный состав (Методист, Медик, Пиар-руководитель)
-- → КиК (Комиссар, Командир). Отдельной технической роли «суперадминистратор» больше нет:
-- полный доступ стал признаком аккаунта, чтобы владелец системы мог числиться кем угодно.

ALTER TABLE "User" ADD COLUMN "isOwner" BOOLEAN NOT NULL DEFAULT false;

-- Бывшие суперадминистраторы: доступ сохраняем через признак, роль опускаем до кандидата.
UPDATE "User" u
   SET "isOwner" = true,
       "roleId" = (SELECT id FROM "Role" WHERE key = 'CANDIDATE')
 WHERE u."roleId" = (SELECT id FROM "Role" WHERE key = 'SUPERADMIN');

-- Старый общий «командный состав» распадается на конкретные роли; кому именно быть методистом,
-- медиком или пиаром — решает командир, поэтому таких пользователей опускаем до бойца.
UPDATE "User" u
   SET "roleId" = (SELECT id FROM "Role" WHERE key = 'FIGHTER')
 WHERE u."roleId" = (SELECT id FROM "Role" WHERE key = 'STAFF');

-- Права ролей уезжают каскадом (RolePermission.roleId → ON DELETE CASCADE).
DELETE FROM "Role" WHERE key IN ('SUPERADMIN', 'STAFF');
