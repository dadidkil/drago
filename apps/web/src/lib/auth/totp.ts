import "server-only";
import { randomBytes } from "node:crypto";
import { decodeBase32IgnorePadding, encodeBase32UpperCaseNoPadding } from "@oslojs/encoding";
import { createTOTPKeyURI, generateHOTP } from "@oslojs/otp";
import { decryptSecret, encryptSecret, randomToken, sha256 } from "@drago/core/crypto";

const PERIOD = 30;
const DIGITS = 6;

export function generateTotpSecret(): { secretBase32: string; encrypted: string } {
  const key = randomBytes(20);
  const secretBase32 = encodeBase32UpperCaseNoPadding(key);
  return { secretBase32, encrypted: encryptSecret(secretBase32) };
}

export function totpUri(secretBase32: string, account: string): string {
  return createTOTPKeyURI("ТОП Драго", account, decodeBase32IgnorePadding(secretBase32), PERIOD, DIGITS);
}

/**
 * Проверяет код с допуском ±1 шаг (часы телефона могут расходиться).
 * Возвращает номер шага, если код верен и шаг новее lastStep (защита от повторного использования).
 */
export function verifyTotp(encryptedSecret: string, code: string, lastStep: number | null): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const key = decodeBase32IgnorePadding(decryptSecret(encryptedSecret));
  const current = Math.floor(Date.now() / 1000 / PERIOD);
  for (const step of [current - 1, current, current + 1]) {
    if (lastStep !== null && step <= lastStep) continue;
    if (generateHOTP(key, BigInt(step), DIGITS) === code) return step;
  }
  return null;
}

/** 8 резервных кодов по 10 символов. Пользователь видит их один раз; в БД — только хэши. */
export function generateRecoveryCodes(): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: 8 }, () =>
    randomToken(10)
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase()
      .slice(0, 10)
      .padEnd(10, "x"),
  );
  return { codes, hashes: codes.map((c) => sha256(c)) };
}

export function hashRecoveryCode(code: string): string {
  return sha256(code.trim().toLowerCase());
}
