"use server";

import { z } from "zod";
import { db } from "@drago/database";
import { audit, decryptSecret } from "@drago/core";
import { userAction, UserError } from "@/lib/actions";

/**
 * Одноразовый показ временного пароля корпоративного ящика ВЛАДЕЛЬЦУ.
 * После показа зашифрованный пароль удаляется из БД. Администратор его не видит никогда.
 */
export const revealTemporaryPassword = userAction({ schema: z.object({}) }, async (_d, { user, ip }) => {
  const account = await db.emailAccount.findUnique({ where: { userId: user.id } });
  if (!account?.pendingSecretEnc || !account.pendingSecretExpiresAt || account.pendingSecretExpiresAt < new Date()) {
    throw new UserError("Временный пароль недоступен. Попросите командный состав выпустить новый.");
  }
  // Атомарно «сжигаем» секрет: показываем, только если именно мы его очистили.
  const res = await db.emailAccount.updateMany({
    where: { id: account.id, pendingSecretEnc: account.pendingSecretEnc },
    data: { pendingSecretEnc: null, pendingSecretExpiresAt: null },
  });
  if (res.count !== 1) throw new UserError("Пароль уже был показан.");
  const password = decryptSecret(account.pendingSecretEnc);
  await audit({ actorId: user.id, action: "mail.temp_password_revealed", entity: "EmailAccount", entityId: account.id, ipAddress: ip });
  return { ok: true, message: "Сохраните пароль сейчас — повторно он не показывается.", data: { password } };
});
