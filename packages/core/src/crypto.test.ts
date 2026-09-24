import { beforeAll, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, generatePassword, generateShortCode, randomToken, safeEqual, sha256 } from "./crypto";

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("crypto", () => {
  it("encrypts and decrypts with AES-GCM", () => {
    const enc = encryptSecret("секрет-123");
    expect(enc).not.toContain("секрет");
    expect(decryptSecret(enc)).toBe("секрет-123");
  });
  it("detects tampering", () => {
    const enc = encryptSecret("value");
    const parts = enc.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });
  it("uses a fresh IV each time", () => {
    expect(encryptSecret("x")).not.toBe(encryptSecret("x"));
  });
  it("generates strong passwords", () => {
    const p = generatePassword();
    expect(p).toHaveLength(20);
    expect(p).toMatch(/\d/);
    expect(new Set(Array.from({ length: 50 }, () => generatePassword())).size).toBe(50);
  });
  it("generates unambiguous short codes", () => {
    expect(generateShortCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
  it("tokens are url-safe and unique", () => {
    const t = randomToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(t);
  });
  it("safeEqual / sha256", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(sha256("drago")).toHaveLength(64);
  });
});
