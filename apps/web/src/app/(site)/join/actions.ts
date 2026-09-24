"use server";

import { z } from "zod";
import { createJoinApplication, rateLimit } from "@drago/core";
import { joinApplicationSchema } from "@drago/shared";
import { publicAction, UserError } from "@/lib/actions";

const schema = joinApplicationSchema.extend({
  consent: z.literal("on", { error: "Нужно согласие на обработку персональных данных" }),
  parentAware: z.literal("on", { error: "Подтверди, что родители знают о заявке" }),
  // Honeypot: скрытое поле, которое заполняют только боты.
  website: z.string().max(0).optional().or(z.literal("")),
});

export const submitJoinApplication = publicAction({ schema }, async (data, { ip }) => {
  const ipKey = ip ?? "unknown";
  const [perHour, perDay] = await Promise.all([rateLimit(`join:h:${ipKey}`, 5, 3600), rateLimit(`join:d:${ipKey}`, 20, 86400)]);
  if (!perHour.ok || !perDay.ok) throw new UserError("Слишком много заявок с этого адреса. Попробуй позже или напиши нам ВКонтакте.");
  if (data.website) return { ok: true, message: "Заявка отправлена!" }; // бот — делаем вид, что всё ок

  await createJoinApplication(
    {
      fullName: data.fullName,
      age: data.age,
      contact: data.contact,
      telegram: data.telegram,
      vk: data.vk,
      school: data.school,
      comment: data.comment,
    },
    { source: "WEB" },
  );
  return { ok: true, message: "Заявка отправлена! Командный состав свяжется с тобой по указанным контактам." };
});
