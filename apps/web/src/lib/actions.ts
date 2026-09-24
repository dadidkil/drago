import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { createLogger } from "@drago/core/logger";
import { parseMoscowInput, type PermissionKey } from "@drago/shared";
import { authorize, ForbiddenError, getCurrentUser, type CurrentUser } from "./auth/current-user";
import { getClientIp } from "./request";

const log = createLogger("web-action");

import type { ActionState } from "./action-state";
export type { ActionState } from "./action-state";

/** Ошибка, текст которой можно показать пользователю. */
export class UserError extends Error {
  constructor(message: string, readonly fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "UserError";
  }
}

export function formToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of fd.entries()) {
    if (rawKey.startsWith("$ACTION")) continue;
    if (rawKey.endsWith("[]")) {
      const key = rawKey.slice(0, -2);
      const arr = (out[key] as unknown[] | undefined) ?? [];
      arr.push(value);
      out[key] = arr;
    } else {
      out[rawKey] = value;
    }
  }
  return out;
}

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

interface Ctx<U> {
  user: U;
  ip: string | null;
  formData: FormData;
}

type Handler<S extends z.ZodType, U> = (data: z.output<S>, ctx: Ctx<U>) => Promise<ActionState | void>;

async function run<S extends z.ZodType, U>(
  schema: S,
  formData: FormData,
  getUser: () => Promise<U>,
  handler: Handler<S, U>,
): Promise<ActionState> {
  try {
    const user = await getUser();
    const parsed = schema.safeParse(formToObject(formData));
    if (!parsed.success) return { error: "Проверьте правильность заполнения полей", fieldErrors: zodFieldErrors(parsed.error) };
    const ip = await getClientIp();
    return (await handler(parsed.data, { user, ip, formData })) ?? { ok: true, message: "Сохранено" };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ForbiddenError) return { error: err.message };
    if (err instanceof UserError) return { error: err.message, fieldErrors: err.fieldErrors };
    log.error("action failed", { err });
    return { error: "Что-то пошло не так. Попробуйте ещё раз или обратитесь к администратору." };
  }
}

/** Действие авторизованного пользователя; при permission — ещё и проверка права (на сервере). */
export function userAction<S extends z.ZodType>(
  opts: { schema: S; permission?: PermissionKey; admin?: boolean },
  handler: Handler<S, CurrentUser>,
) {
  return async (_prev: ActionState, formData: FormData): Promise<ActionState> =>
    run(opts.schema, formData, () => authorize(opts.permission, { admin: opts.admin ?? Boolean(opts.permission) }), handler);
}

/** Публичное действие (вход, заявка) — пользователь может отсутствовать. */
export function publicAction<S extends z.ZodType>(opts: { schema: S }, handler: Handler<S, CurrentUser | null>) {
  return async (_prev: ActionState, formData: FormData): Promise<ActionState> =>
    run(opts.schema, formData, () => getCurrentUser(), handler);
}

// ── Zod-хелперы для FormData ──────────────────────────────────────────────

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const zf = {
  bool: () => z.preprocess((v) => v === "on" || v === "true" || v === "1", z.boolean()),
  str: (min: number, max: number, msg = "Заполните поле") =>
    z.string({ error: msg }).trim().min(min, msg).max(max, `Не длиннее ${max} символов`),
  optStr: (max: number) => z.preprocess(emptyToUndefined, z.string().trim().max(max, `Не длиннее ${max} символов`).optional()),
  int: (min: number, max: number) => z.coerce.number({ error: "Введите число" }).int("Введите целое число").min(min).max(max),
  optInt: (min: number, max: number) =>
    z.preprocess(emptyToUndefined, z.coerce.number({ error: "Введите число" }).int().min(min).max(max).optional()),
  dateMsk: (msg = "Укажите дату и время") =>
    z.string({ error: msg }).transform((v, ctx) => {
      const d = parseMoscowInput(v);
      if (!d) {
        ctx.addIssue({ code: "custom", message: msg });
        return z.NEVER;
      }
      return d;
    }),
  optDateMsk: () =>
    z.preprocess(
      emptyToUndefined,
      z
        .string()
        .optional()
        .transform((v, ctx) => {
          if (!v) return undefined;
          const d = parseMoscowInput(v);
          if (!d) {
            ctx.addIssue({ code: "custom", message: "Неверная дата" });
            return z.NEVER;
          }
          return d;
        }),
    ),
  ids: () => z.array(z.string().regex(/^[a-z0-9]{10,40}$/i)).max(500).default([]),
  id: () => z.string().regex(/^[a-z0-9]{10,40}$/i, "Неверный идентификатор"),
  file: () => z.instanceof(File).optional(),
  files: () => z.array(z.instanceof(File)).max(10).default([]),
  slug: () =>
    z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Только латиница, цифры и дефис")
        .max(80)
        .optional(),
    ),
};
