import "server-only";
import { db, type AuthTokenType } from "@drago/database";
import { randomToken, sha256 } from "@drago/core/crypto";

const TTL: Record<AuthTokenType, number> = {
  INVITE: 72 * 3600_000,
  PASSWORD_RESET: 3600_000,
  EMAIL_VERIFY: 24 * 3600_000,
};

/** Одноразовый токен (приглашение, сброс пароля, подтверждение email). Старые токены того же типа аннулируются. */
export async function issueAuthToken(userId: string, type: AuthTokenType): Promise<string> {
  const token = randomToken(32);
  await db.$transaction([
    db.authToken.deleteMany({ where: { userId, type, usedAt: null } }),
    db.authToken.create({ data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TTL[type]) } }),
  ]);
  return token;
}

/** Проверка без «сжигания» — для отображения формы. */
export async function peekAuthToken(token: string | undefined, type: AuthTokenType) {
  if (!token || token.length > 100) return null;
  const row = await db.authToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, email: true, status: true, profile: { select: { firstName: true } } } } },
  });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}

/** Атомарное использование токена. Возвращает userId или null. */
export async function consumeAuthToken(token: string, type: AuthTokenType): Promise<string | null> {
  const row = await peekAuthToken(token, type);
  if (!row) return null;
  const res = await db.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return res.count === 1 ? row.userId : null;
}
