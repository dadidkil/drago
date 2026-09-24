import { z } from "zod";

/**
 * Типизированные настройки, хранящиеся в таблице Setting (key → JSON).
 * Секреты (токены ботов, пароли SMTP) здесь НЕ хранятся — только в .env.
 */

const url = z.union([z.url(), z.literal("")]);

/** Официальная подача заявки в трудовые отряды подростков — приложение МосРСО в сообществе ВКонтакте. */
export const JOIN_URL_DEFAULT = "https://vk.ru/rso_mosrso_top?w=app5619682_-219801650";

export const settingSchemas = {
  "site.general": z.object({
    siteName: z.string().min(1).max(80),
    heroTitle: z.string().min(1).max(80),
    heroSubtitle: z.string().max(300),
    tagline: z.string().max(200),
    recruitmentOpen: z.boolean(),
    recruitmentText: z.string().max(500),
    /** Куда ведёт «Подать заявку». Заявки в ТОП принимает МосРСО в своём приложении ВКонтакте, сайт их не собирает. */
    joinUrl: z.url(),
  }),
  "site.contacts": z.object({
    email: z.union([z.email(), z.literal("")]),
    phone: z.string().max(40),
    address: z.string().max(200),
    vkUrl: url,
    telegramUrl: url,
    extraLinks: z.array(z.object({ label: z.string().min(1).max(60), url: z.url() })).max(10),
    note: z.string().max(500),
  }),
  security: z.object({
    requireStaff2fa: z.boolean(),
  }),
  privacy: z.object({
    applicationRetentionDays: z.number().int().min(30).max(1095),
    auditRetentionDays: z.number().int().min(90).max(1825),
  }),
  integrations: z.object({
    telegramBotUsername: z.string().max(64),
    telegramNotifyApplications: z.boolean(),
  }),
  mail: z.object({
    domain: z.string().min(3).max(100),
    webmailUrl: url,
    imapHost: z.string().max(100),
    smtpHost: z.string().max(100),
  }),
} as const;

export type SettingKey = keyof typeof settingSchemas;
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingSchemas)[K]>;

export const SETTING_DEFAULTS: { [K in SettingKey]: SettingValue<K> } = {
  "site.general": {
    siteName: "ТОП «Драго»",
    heroTitle: "ТОП Драго",
    heroSubtitle:
      "Трудовой отряд подростков Москвы. Первая работа, настоящая команда и лето, которое запоминается.",
    tagline: "Огонь, вода, земля и воздух: вместе эти стихии создают — ТОП «Драго»",
    recruitmentOpen: true,
    recruitmentText: "Принимаем ребят 14–17 лет, которые учатся в школе или колледже Москвы.",
    joinUrl: JOIN_URL_DEFAULT,
  },
  "site.contacts": {
    email: "",
    phone: "",
    address: "Москва",
    vkUrl: "https://vk.com/top_drago",
    telegramUrl: "",
    extraLinks: [],
    note: "Быстрее всего ответим в сообщениях сообщества ВКонтакте.",
  },
  security: {
    requireStaff2fa: true,
  },
  privacy: {
    applicationRetentionDays: 365,
    auditRetentionDays: 730,
  },
  integrations: {
    telegramBotUsername: "",
    telegramNotifyApplications: true,
  },
  mail: {
    domain: "dragotop.ru",
    webmailUrl: "https://webmail.dragotop.ru",
    imapHost: "mail.dragotop.ru",
    smtpHost: "mail.dragotop.ru",
  },
};

export const SETTING_KEYS = Object.keys(settingSchemas) as SettingKey[];

/** Безопасно разбирает сохранённое значение; при несовпадении схемы — значение по умолчанию. */
export function parseSetting<K extends SettingKey>(key: K, raw: unknown): SettingValue<K> {
  const merged =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(SETTING_DEFAULTS[key] as object), ...(raw as object) }
      : SETTING_DEFAULTS[key];
  const parsed = settingSchemas[key].safeParse(merged);
  return (parsed.success ? parsed.data : SETTING_DEFAULTS[key]) as SettingValue<K>;
}
