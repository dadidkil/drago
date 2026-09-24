import { db, type ApplicationSource } from "@drago/database";
import { APPLICATION_SOURCE_LABELS, type JoinApplicationInput } from "@drago/shared";
import { notifyByPermission } from "./notifications";
import { getSetting } from "./settings";

/**
 * Единая точка создания заявки (сайт, VK-бот, Telegram-бот).
 * Сохраняет заявку и уведомляет командный состав с правом applications.read.
 */
export async function createJoinApplication(
  input: JoinApplicationInput,
  meta: { source: ApplicationSource; vkUserId?: bigint | null },
) {
  const application = await db.joinApplication.create({
    data: {
      fullName: input.fullName,
      age: input.age,
      contact: input.contact,
      telegram: input.telegram?.replace(/^@/, ""),
      vk: input.vk,
      school: input.school,
      comment: input.comment,
      source: meta.source,
      vkUserId: meta.vkUserId ?? null,
      consentAt: new Date(),
    },
  });

  const integrations = await getSetting("integrations");
  await notifyByPermission("applications.read", {
    type: "APPLICATION_NEW",
    title: "Новая заявка на вступление",
    // Минимум ПДн во внешних каналах: имя и источник, детали — только в админке.
    body: `${input.fullName}, ${input.age} лет. Источник: ${APPLICATION_SOURCE_LABELS[meta.source]}.`,
    url: `/admin/applications/${application.id}`,
    onlyChannels: integrations.telegramNotifyApplications ? undefined : ["EMAIL"],
  });

  return application;
}
