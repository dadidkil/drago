import { db, type LinkChannel, type Prisma } from "@drago/database";

/**
 * Состояние многошаговых диалогов ботов (VK/Telegram), например создания объявления.
 * Хранится в BotConversation, живёт 30 минут.
 */

const TTL_MS = 30 * 60_000;

export async function getConversation(channel: LinkChannel, externalUserId: bigint) {
  const conv = await db.botConversation.findUnique({ where: { channel_externalUserId: { channel, externalUserId } } });
  if (!conv || conv.expiresAt < new Date()) return null;
  return conv;
}

export async function setConversation(channel: LinkChannel, externalUserId: bigint, state: string, data: Prisma.InputJsonValue) {
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.botConversation.upsert({
    where: { channel_externalUserId: { channel, externalUserId } },
    create: { channel, externalUserId, state, data, expiresAt },
    update: { state, data, expiresAt },
  });
}

export async function clearConversation(channel: LinkChannel, externalUserId: bigint) {
  await db.botConversation.deleteMany({ where: { channel, externalUserId } });
}
