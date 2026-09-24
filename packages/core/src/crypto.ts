import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** Криптографически стойкий токен в base64url (по умолчанию 32 байта = 256 бит). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    // Сравниваем с самим собой, чтобы время не зависело от длины
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const SYMBOLS = "-_.!@#%";

/**
 * Временный пароль: 20 символов без похожих букв (0/O, 1/l), с цифрой и символом.
 * ~115 бит энтропии.
 */
export function generatePassword(length = 20): string {
  const chars: string[] = [];
  for (let i = 0; i < length - 2; i++) chars.push(PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]!);
  chars.push(String(randomInt(2, 10)));
  chars.push(SYMBOLS[randomInt(SYMBOLS.length)]!);
  // Перемешивание Фишера–Йетса
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

/** Короткий код для ручного ввода (привязка VK): 8 символов без похожих букв. */
export function generateShortCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

function encryptionKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) throw new Error("APP_ENCRYPTION_KEY не задан");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("APP_ENCRYPTION_KEY должен быть 32 байта в base64 (openssl rand -base64 32)");
  return key;
}

/** AES-256-GCM. Формат: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(payload: string): string {
  const [version, iv, tag, ct] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !ct) throw new Error("Неверный формат зашифрованных данных");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
