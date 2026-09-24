"use server";

import { z } from "zod";
import { audit, notificationMail, rateLimit, sendMail, setSetting } from "@drago/core";
import { userAction, UserError, zf } from "@/lib/actions";

export const saveIntegrations = userAction(
  {
    permission: "integrations.manage",
    schema: z.object({
      telegramBotUsername: z.string().trim().max(64).regex(/^@?[A-Za-z0-9_]*$/, "Только латиница, цифры и _"),
      telegramNotifyApplications: zf.bool(),
      vkApplicationsEnabled: zf.bool(),
    }),
  },
  async (d, { user, ip }) => {
    await setSetting("integrations", { ...d, telegramBotUsername: d.telegramBotUsername.replace(/^@/, "") }, { id: user.id, ip });
    await audit({ actorId: user.id, action: "integration.update", entity: "Setting", entityId: "integrations", ipAddress: ip, metadata: d });
    return { ok: true, message: "Сохранено" };
  },
);

export const sendTestEmail = userAction({ permission: "integrations.manage", schema: z.object({}) }, async (_d, { user, ip }) => {
  const limit = await rateLimit(`test-mail:${user.id}`, 5, 3600);
  if (!limit.ok) throw new UserError("Не чаще 5 писем в час");
  try {
    await sendMail(notificationMail(user.email, "Тестовое письмо", "Если вы видите это письмо — исходящая почта сайта работает. Проверьте, что оно не попало в спам.", "/admin/integrations"));
  } catch (err) {
    throw new UserError(`Ошибка SMTP: ${(err as Error).message.slice(0, 300)}`);
  }
  await audit({ actorId: user.id, action: "integration.smtp_test", entity: "Setting", entityId: "smtp", ipAddress: ip });
  return { ok: true, message: `Письмо отправлено на ${user.email}` };
});
