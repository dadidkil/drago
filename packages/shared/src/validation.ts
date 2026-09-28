import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max);

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Минимум ${PASSWORD_MIN} символов`)
  .max(PASSWORD_MAX, `Максимум ${PASSWORD_MAX} символов`)
  .refine((v) => /[A-Za-zА-Яа-яЁё]/.test(v) && /\d/.test(v), "Пароль должен содержать буквы и цифры");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Некорректный email"));

const telegramRe = /^@?[A-Za-z0-9_]{4,32}$/;
const vkRe = /^(https?:\/\/)?(m\.)?(vk\.(com|ru)\/)?[A-Za-z0-9_.]{2,64}$/;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Введите пароль").max(PASSWORD_MAX),
});

export const totpCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^(\d{6}|[a-z0-9]{10})$/i, "Введите 6 цифр из приложения или резервный код"));

/** Локальная часть корпоративного адреса: ivan.ivanov */
export const mailboxLocalPartSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+([._-][a-z0-9]+)*$/, "Латиница, цифры, точка, дефис")
  .min(3)
  .max(48)
  .refine((v) => !RESERVED_MAILBOXES.has(v), "Этот адрес зарезервирован");

export const RESERVED_MAILBOXES = new Set([
  "admin",
  "administrator",
  "postmaster",
  "abuse",
  "hostmaster",
  "webmaster",
  "root",
  "noreply",
  "no-reply",
  "mailer-daemon",
  "security",
  "dmarc",
  "info",
  "support",
]);
