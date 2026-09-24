import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_KEYS,
  ROLE_LEVELS,
  canManageLevel,
  joinApplicationSchema,
  mailboxLocalPartSchema,
  parseMoscowInput,
  parseSetting,
  passwordSchema,
  plural,
  slugify,
  suggestMailbox,
  toMoscowInputValue,
} from "./index";

describe("rbac", () => {
  it("SUPERADMIN has every permission by default", () => {
    expect(new Set(DEFAULT_ROLE_PERMISSIONS.SUPERADMIN)).toEqual(new Set(PERMISSION_KEYS));
  });
  it("fighters and candidates have no admin permissions", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.FIGHTER).toHaveLength(0);
    expect(DEFAULT_ROLE_PERMISSIONS.CANDIDATE).toHaveLength(0);
  });
  it("only strictly lower levels are manageable (except superadmin)", () => {
    expect(canManageLevel(ROLE_LEVELS.COMMANDER, ROLE_LEVELS.COMMISSAR)).toBe(true);
    expect(canManageLevel(ROLE_LEVELS.COMMANDER, ROLE_LEVELS.COMMANDER)).toBe(false);
    expect(canManageLevel(ROLE_LEVELS.COMMISSAR, ROLE_LEVELS.COMMANDER)).toBe(false);
    expect(canManageLevel(ROLE_LEVELS.SUPERADMIN, ROLE_LEVELS.SUPERADMIN)).toBe(true);
  });
  it("any role with admin permissions also has admin.access", () => {
    for (const perms of Object.values(DEFAULT_ROLE_PERMISSIONS)) {
      if (perms.length > 0) expect(perms).toContain("admin.access");
    }
  });
});

describe("validation", () => {
  const base = { fullName: "Иванов Иван", age: "15", contact: "+7 900 000-00-00" };
  it("accepts a minimal application", () => {
    expect(joinApplicationSchema.safeParse(base).success).toBe(true);
  });
  it("rejects ages outside 14–17", () => {
    expect(joinApplicationSchema.safeParse({ ...base, age: "13" }).success).toBe(false);
    expect(joinApplicationSchema.safeParse({ ...base, age: "18" }).success).toBe(false);
  });
  it("rejects markup in names", () => {
    expect(joinApplicationSchema.safeParse({ ...base, fullName: "<script>alert(1)</script>" }).success).toBe(false);
  });
  it("validates telegram usernames", () => {
    expect(joinApplicationSchema.safeParse({ ...base, telegram: "@drago_top" }).success).toBe(true);
    expect(joinApplicationSchema.safeParse({ ...base, telegram: "bad name!" }).success).toBe(false);
  });
  it("password policy", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("onlyletterslong").success).toBe(false);
    expect(passwordSchema.safeParse("длинный-пароль-2026").success).toBe(true);
  });
  it("mailbox local part", () => {
    expect(mailboxLocalPartSchema.safeParse("ivan.ivanov").success).toBe(true);
    expect(mailboxLocalPartSchema.safeParse("postmaster").success).toBe(false);
    expect(mailboxLocalPartSchema.safeParse("иван").success).toBe(false);
  });
});

describe("format & slug", () => {
  it("round-trips Moscow datetime-local values", () => {
    const d = parseMoscowInput("2026-07-01T10:30")!;
    expect(d.toISOString()).toBe("2026-07-01T07:30:00.000Z");
    expect(toMoscowInputValue(d)).toBe("2026-07-01T10:30");
  });
  it("rejects garbage dates", () => {
    expect(parseMoscowInput("not a date")).toBeNull();
  });
  it("pluralizes russian", () => {
    expect(plural(1, "фото", "фото", "фото")).toBe("фото");
    expect(plural(3, "год", "года", "лет")).toBe("года");
    expect(plural(11, "год", "года", "лет")).toBe("лет");
  });
  it("transliterates slugs", () => {
    expect(slugify("Выезд в лагерь 2026!")).toBe("vyezd-v-lager-2026");
    expect(suggestMailbox("Иван", "Иванов")).toBe("ivan.ivanov");
  });
  it("falls back to defaults on invalid settings", () => {
    expect(parseSetting("security", { requireStaff2fa: "yes" }).requireStaff2fa).toBe(true);
    expect(parseSetting("privacy", null).applicationRetentionDays).toBe(365);
  });
});
