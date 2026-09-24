import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Argon2id, параметры по рекомендациям OWASP (m=19 MiB, t=2, p=1).
const OPTIONS = { algorithm: 2 /* Argon2id */, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/**
 * Проверка против «пустышки», когда пользователь не найден, — чтобы время ответа
 * не выдавало существование аккаунта (защита от перечисления).
 */
export async function verifyDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword("dummy-password-for-timing-equalization");
  await verifyPassword(await dummyHash, password);
}
