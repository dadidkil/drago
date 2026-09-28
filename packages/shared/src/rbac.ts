/**
 * RBAC ТОП «Драго».
 *
 * Источник истины для набора прав — этот файл (сидируется в таблицы Role/Permission/RolePermission).
 * Матрицу «роль → права» правит командир в админ-панели; у командира всегда все права.
 * Отдельной технической роли «суперадминистратор» нет: полный доступ — это признак аккаунта
 * (`User.isOwner`), чтобы владелец системы мог числиться в отряде кем угодно, хоть кандидатом.
 * Проверки выполняются на сервере (server actions / route handlers / боты), а не скрытием кнопок.
 */

export const ROLE_KEYS = ["COMMANDER", "COMMISSAR", "METHODIST", "MEDIC", "PR_LEAD", "FIGHTER", "CANDIDATE"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

/** Уровень роли в иерархии. Управлять можно только теми, у кого уровень строго ниже. */
export const ROLE_LEVELS: Record<RoleKey, number> = {
  COMMANDER: 80,
  COMMISSAR: 60,
  // Командный состав: методист, медик и пиар-руководитель равны между собой.
  METHODIST: 40,
  MEDIC: 40,
  PR_LEAD: 40,
  FIGHTER: 20,
  CANDIDATE: 10,
};

/**
 * Уровень владельца системы (`User.isOwner`). Выше любой роли, поэтому такой аккаунт
 * управляет всеми и видит любую аудиторию, оставаясь в отряде на своей обычной роли.
 */
export const OWNER_LEVEL = 1000;

/** Роли командного состава — те, кому по умолчанию открыта админ-панель. */
export const STAFF_ROLE_KEYS = ["COMMANDER", "COMMISSAR", "METHODIST", "MEDIC", "PR_LEAD"] as const satisfies readonly RoleKey[];

export const ROLE_NAMES: Record<RoleKey, string> = {
  COMMANDER: "Командир",
  COMMISSAR: "Комиссар",
  METHODIST: "Методист",
  MEDIC: "Медик",
  PR_LEAD: "Пиар-руководитель",
  FIGHTER: "Боец",
  CANDIDATE: "Кандидат",
};

export const ROLE_DESCRIPTIONS: Record<RoleKey, string> = {
  COMMANDER: "Командир отряда: полный доступ ко всей системе",
  COMMISSAR: "Комиссар: контент, мероприятия, объявления, внутренние активности",
  METHODIST: "Методист: обучение, мероприятия, задачи, документы, формы",
  MEDIC: "Медик: состав отряда, медицинские допуски и документы",
  PR_LEAD: "Пиар-руководитель: новости, объявления, галерея и страницы сайта",
  FIGHTER: "Боец отряда",
  CANDIDATE: "Кандидат на вступление, ограниченный кабинет",
};

/** Аудитории для объявлений, событий, документов (минимальный уровень роли). */
export const AUDIENCES = [
  { level: 10, label: "Все, включая кандидатов" },
  { level: 20, label: "Бойцы и командный состав" },
  { level: 40, label: "Только командный состав" },
  { level: 60, label: "Командир и комиссар (КиК)" },
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
  "surveys.manage": "Формы и опросы: создание и настройка",
  "surveys.results": "Результаты форм (ответы бойцов, в том числе о самочувствии)",
  "mail.manage": "Корпоративная почта @dragotop.ru",
  "integrations.manage": "Интеграции (Telegram, VK, почта)",
  "audit.read": "Журнал аудита",
  "settings.manage": "Настройки системы и матрица прав",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

const ALL = PERMISSION_KEYS;

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, readonly PermissionKey[]> = {
  COMMANDER: ALL,
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
    "surveys.manage",
    "surveys.results",
  ],
  // Методист ведёт обучение и активности: мероприятия, задачи, методички, формы.
  METHODIST: ["admin.access", "users.read", "events.manage", "tasks.manage", "documents.manage", "surveys.manage", "surveys.results"],
  // Медик работает с составом и документами (допуски, справки), контент сайта не трогает.
  MEDIC: ["admin.access", "users.read", "documents.manage"],
  // Пиар отвечает за внешнюю витрину: новости, объявления, галерея, страницы.
  PR_LEAD: ["admin.access", "users.read", "news.manage", "announcements.manage", "gallery.manage", "pages.manage"],
  FIGHTER: [],
  CANDIDATE: [],
};

export function isRoleKey(value: string): value is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(value);
}

/**
 * Может ли актор с уровнем actorLevel управлять пользователем/назначать роль уровня targetLevel.
 * Владелец системы (OWNER_LEVEL) может всё, включая назначение командира; остальные — только строго ниже себя.
 */
export function canManageLevel(actorLevel: number, targetLevel: number): boolean {
  if (actorLevel >= OWNER_LEVEL) return true;
  return targetLevel < actorLevel;
}

/** Порог «командного состава» — для 2FA, доступа к админке и т. п. */
export const STAFF_LEVEL = ROLE_LEVELS.METHODIST;
export const FIGHTER_LEVEL = ROLE_LEVELS.FIGHTER;
