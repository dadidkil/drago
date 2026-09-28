import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROLE_PERMISSIONS,
  OWNER_LEVEL,
  STAFF_ROLE_KEYS,
  PERMISSION_KEYS,
  ROLE_LEVELS,
  canManageLevel,
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
  it("COMMANDER has every permission by default", () => {
    expect(new Set(DEFAULT_ROLE_PERMISSIONS.COMMANDER)).toEqual(new Set(PERMISSION_KEYS));
  });
  it("staff roles are the ones with admin access", () => {
    for (const key of STAFF_ROLE_KEYS) expect(DEFAULT_ROLE_PERMISSIONS[key]).toContain("admin.access");
    expect(ROLE_LEVELS.METHODIST).toBe(ROLE_LEVELS.MEDIC);
    expect(ROLE_LEVELS.PR_LEAD).toBe(ROLE_LEVELS.MEDIC);
  });
  it("fighters and candidates have no admin permissions", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.FIGHTER).toHaveLength(0);
    expect(DEFAULT_ROLE_PERMISSIONS.CANDIDATE).toHaveLength(0);
  });
  it("only strictly lower levels are manageable, owner manages everyone", () => {
    expect(canManageLevel(ROLE_LEVELS.COMMANDER, ROLE_LEVELS.COMMISSAR)).toBe(true);
    expect(canManageLevel(ROLE_LEVELS.COMMANDER, ROLE_LEVELS.COMMANDER)).toBe(false);
    expect(canManageLevel(ROLE_LEVELS.COMMISSAR, ROLE_LEVELS.COMMANDER)).toBe(false);
    expect(canManageLevel(ROLE_LEVELS.METHODIST, ROLE_LEVELS.MEDIC)).toBe(false);
    expect(canManageLevel(OWNER_LEVEL, ROLE_LEVELS.COMMANDER)).toBe(true);
  });
  it("any role with admin permissions also has admin.access", () => {
    for (const perms of Object.values(DEFAULT_ROLE_PERMISSIONS)) {
      if (perms.length > 0) expect(perms).toContain("admin.access");
    }
  });
});

describe("validation", () => {
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
    expect(parseSetting("privacy", null).auditRetentionDays).toBe(730);
  });
});
