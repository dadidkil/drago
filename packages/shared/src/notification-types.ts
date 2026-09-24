export const NOTIFICATION_TYPES = [
  "ANNOUNCEMENT",
  "TASK_ASSIGNED",
  "TASK_DEADLINE",
  "TASK_COMMENT",
  "EVENT_CREATED",
  "EVENT_UPDATED",
  "EVENT_REMINDER",
  "APPLICATION_NEW",
  "MAIL_READY",
  "SYSTEM",
] as const;
export type NotificationTypeKey = (typeof NOTIFICATION_TYPES)[number];

export const EXTERNAL_CHANNELS = ["TELEGRAM", "VK", "EMAIL"] as const;
export type ExternalChannel = (typeof EXTERNAL_CHANNELS)[number];

export const NOTIFICATION_META: Record<
  NotificationTypeKey,
  { label: string; defaults: Record<ExternalChannel, boolean>; configurable: boolean }
> = {
  ANNOUNCEMENT: { label: "Новые объявления", defaults: { TELEGRAM: true, VK: false, EMAIL: false }, configurable: true },
  TASK_ASSIGNED: { label: "Новые задачи", defaults: { TELEGRAM: true, VK: false, EMAIL: true }, configurable: true },
  TASK_DEADLINE: { label: "Приближение дедлайна", defaults: { TELEGRAM: true, VK: false, EMAIL: false }, configurable: true },
  TASK_COMMENT: { label: "Комментарии к задачам", defaults: { TELEGRAM: true, VK: false, EMAIL: false }, configurable: true },
  EVENT_CREATED: { label: "Новые мероприятия", defaults: { TELEGRAM: true, VK: false, EMAIL: false }, configurable: true },
  EVENT_UPDATED: { label: "Изменения мероприятий", defaults: { TELEGRAM: true, VK: false, EMAIL: true }, configurable: true },
  EVENT_REMINDER: { label: "Напоминания о мероприятиях", defaults: { TELEGRAM: true, VK: false, EMAIL: false }, configurable: true },
  APPLICATION_NEW: { label: "Новые заявки (командный состав)", defaults: { TELEGRAM: true, VK: false, EMAIL: true }, configurable: true },
  MAIL_READY: { label: "Корпоративная почта", defaults: { TELEGRAM: true, VK: false, EMAIL: true }, configurable: false },
  SYSTEM: { label: "Системные сообщения", defaults: { TELEGRAM: false, VK: false, EMAIL: true }, configurable: false },
};
