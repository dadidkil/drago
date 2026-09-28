export const TASK_STATUS_LABELS = {
  NEW: "Новая",
  IN_PROGRESS: "В работе",
  REVIEW: "На проверке",
  DONE: "Выполнена",
  CANCELLED: "Отменена",
} as const;

/** Статус задачи у исполнителя: получил → в работе → сдал → проверил поставивший → принята (выполнено). */
export const ASSIGNEE_STATUS_LABELS = {
  ASSIGNED: "Новая",
  IN_PROGRESS: "В работе",
  SUBMITTED: "Сдана, ждёт проверки",
  RETURNED: "На доработке",
  ACCEPTED: "Принята",
} as const;

export const EVENT_TYPE_LABELS = {
  EVENT: "Мероприятие",
  MEETING: "Собрание",
  TRIP: "Выезд",
  WORK: "Трудовой проект",
  DEADLINE: "Дедлайн",
  OTHER: "Другое",
} as const;

export const PARTICIPATION_LABELS = {
  INVITED: "Приглашён",
  GOING: "Иду",
  MAYBE: "Возможно",
  NOT_GOING: "Не иду",
  ATTENDED: "Присутствовал",
} as const;

export const USER_STATUS_LABELS = {
  INVITED: "Приглашён",
  ACTIVE: "Активен",
  SUSPENDED: "Заблокирован",
  ARCHIVED: "В архиве",
} as const;

export const PUBLISH_STATUS_LABELS = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликовано",
  ARCHIVED: "В архиве",
} as const;

export const MAILBOX_STATUS_LABELS = {
  PENDING: "Создаётся",
  ACTIVE: "Активен",
  DISABLED: "Отключён",
  ERROR: "Ошибка",
} as const;

export const CHANNEL_LABELS = {
  IN_APP: "В кабинете",
  EMAIL: "Email",
  TELEGRAM: "Telegram",
  VK: "ВКонтакте",
} as const;
