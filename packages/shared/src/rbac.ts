/**
 * RBAC ТОП «Драго».
 *
 * Источник истины для набора прав — этот файл (сидируется в таблицы Role/Permission/RolePermission).
 * Матрицу «роль → права» SUPERADMIN может менять в админ-панели; SUPERADMIN всегда имеет все права.
 * Проверки выполняются на сервере (server actions / route handlers / боты), а не скрытием кнопок.
 */

export const ROLE_KEYS = ["SUPERADMIN", "COMMANDER", "COMMISSAR", "STAFF", "FIGHTER", "CANDIDATE"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

/** Уровень роли в иерархии. Управлять можно только теми, у кого уровень строго ниже. */
export const ROLE_LEVELS: Record<RoleKey, number> = {
  SUPERADMIN: 100,
  COMMANDER: 80,
  COMMISSAR: 60,
  STAFF: 40,
  FIGHTER: 20,
  CANDIDATE: 10,
};

export const ROLE_NAMES: Record<RoleKey, string> = {
  SUPERADMIN: "Суперадминистратор",
  COMMANDER: "Командир",
  COMMISSAR: "Комиссар",
  STAFF: "Командный состав",
  FIGHTER: "Боец",
  CANDIDATE: "Кандидат",
};

export const ROLE_DESCRIPTIONS: Record<RoleKey, string> = {
  SUPERADMIN: "Полный доступ ко всей системе",
  COMMANDER: "Управление отрядом, пользователями, мероприятиями, задачами, документами",
  COMMISSAR: "Контент, мероприятия, объявления, внутренние активности",
  STAFF: "Ограниченные административные возможности",
  FIGHTER: "Боец отряда",
  CANDIDATE: "Кандидат на вступление, ограниченный кабинет",
};

/** Аудитории для объявлений, событий, документов (минимальный уровень роли). */
export const AUDIENCES = [
  { level: 10, label: "Все, включая кандидатов" },
  { level: 20, label: "Бойцы и командный состав" },
  { level: 40, label: "Только командный состав" },
  { level: 60, label: "Командир и комиссар" },
] as const;

export function audienceLabel(level: number): string {
  const exact = AUDIENCES.find((a) => a.level === level);
  if (exact) return exact.label;
  return `Уровень ${level}+`;
}

export const PERMISSIONS = {
  "admin.access": "Вход в админ-панель",
  "users.read": "Просмотр пользователей и их контактов",
  "users.manage": "Создание и редактирование пользователей",
  "users.roles": "Назначение ролей",
  "users.delete": "Удаление и архивирование пользователей",
  "news.manage": "Новости сайта",
  "announcements.manage": "Объявления в кабинете",
  "events.manage": "Мероприятия и календарь",
  "tasks.manage": "Создание и назначение задач",
  "documents.manage": "Загрузка и управление документами",
  "gallery.manage": "Галерея",
  "pages.manage": "Страницы сайта, люди, проекты, достижения, FAQ, контакты",
  "applications.read": "Просмотр заявок на вступление",
  "applications.manage": "Обработка заявок на вступление",
  "mail.manage": "Корпоративная почта @dragotop.ru",
  "integrations.manage": "Интеграции (Telegram, VK, почта)",
  "audit.read": "Журнал аудита",
  "settings.manage": "Настройки системы и матрица прав",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

const ALL = PERMISSION_KEYS;

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, readonly PermissionKey[]> = {
  SUPERADMIN: ALL,
  COMMANDER: [
    "admin.access",
    "users.read",
    "users.manage",
    "users.roles",
    "users.delete",
    "news.manage",
    "announcements.manage",
    "events.manage",
    "tasks.manage",
    "documents.manage",
    "gallery.manage",
    "pages.manage",
    "applications.read",
    "applications.manage",
    "mail.manage",
    "audit.read",
  ],
  COMMISSAR: [
    "admin.access",
    "users.read",
    "news.manage",
    "announcements.manage",
    "events.manage",
    "tasks.manage",
    "documents.manage",
    "gallery.manage",
    "pages.manage",
    "applications.read",
    "applications.manage",
  ],
  STAFF: ["admin.access", "users.read", "announcements.manage", "events.manage", "tasks.manage", "applications.read"],
  FIGHTER: [],
  CANDIDATE: [],
};

export function isRoleKey(value: string): value is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(value);
}

/**
 * Может ли актор с уровнем actorLevel управлять пользователем/назначать роль уровня targetLevel.
 * SUPERADMIN может всё (в том числе назначать других SUPERADMIN), остальные — только строго ниже себя.
 */
export function canManageLevel(actorLevel: number, targetLevel: number): boolean {
  if (actorLevel >= ROLE_LEVELS.SUPERADMIN) return true;
  return targetLevel < actorLevel;
}

/** Порог «командного состава» — для 2FA, доступа к админке и т. п. */
export const STAFF_LEVEL = ROLE_LEVELS.STAFF;
export const FIGHTER_LEVEL = ROLE_LEVELS.FIGHTER;
