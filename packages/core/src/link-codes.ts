import { db, type LinkChannel } from "@drago/database";
import { generateShortCode, randomToken, sha256 } from "./crypto";

const TTL_MS = 10 * 60 * 1000;

/**
 * Одноразовый код привязки мессенджера.
 * TELEGRAM — длинный токен для deep link t.me/<bot>?start=link_<token>;
 * VK — короткий код, который пользователь отправляет сообществу («привязать ABCD2345»).
 * В БД хранится только хэш.
 */
export async function createLinkCode(userId: string, channel: LinkChannel): Promise<{ code: string; expiresAt: Date }> {
  const code = channel === "TELEGRAM" ? randomToken(24) : generateShortCode(8);
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.$transaction([
    db.linkCode.deleteMany({ where: { userId, channel, usedAt: null } }),
    db.linkCode.create({ data: { userId, channel, codeHash: sha256(normalize(channel, code)), expiresAt } }),
  ]);
  return { code, expiresAt };
}

function normalize(channel: LinkChannel, code: string): string {
  return channel === "VK" ? code.trim().toUpperCase() : code.trim();
}

/** Атомарно «сжигает» код. Возвращает userId или null. */
export async function consumeLinkCode(channel: LinkChannel, code: string): Promise<string | null> {
  if (!code || code.length > 64) return null;
  const codeHash = sha256(normalize(channel, code));
  const row = await db.linkCode.findUnique({ where: { codeHash } });
  if (!row || row.channel !== channel || row.usedAt || row.expiresAt < new Date()) return null;
  const res = await db.linkCode.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return res.count === 1 ? row.userId : null;
}
