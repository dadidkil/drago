import { db } from "@drago/database";

/**
 * Идемпотентность входящих событий: true — событие новое и его нужно обработать,
 * false — уже обрабатывалось (повторная доставка VK/Telegram).
 */
export async function markProcessed(source: string, externalId: string): Promise<boolean> {
  const res = await db.processedUpdate.createMany({
    data: [{ source, externalId }],
    skipDuplicates: true,
  });
  return res.count === 1;
}
