import { db, type Prisma } from "@drago/database";
import { parseSetting, settingSchemas, type SettingKey, type SettingValue } from "@drago/shared";
import { audit } from "./audit";

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const row = await db.setting.findUnique({ where: { key } });
  return parseSetting(key, row?.value);
}

export async function getSettings<K extends SettingKey>(keys: K[]): Promise<{ [P in K]: SettingValue<P> }> {
  const rows = await db.setting.findMany({ where: { key: { in: keys } } });
  const out = {} as { [P in K]: SettingValue<P> };
  for (const key of keys) {
    out[key] = parseSetting(key, rows.find((r) => r.key === key)?.value) as SettingValue<typeof key>;
  }
  return out;
}

export async function setSetting<K extends SettingKey>(
  key: K,
  value: SettingValue<K>,
  actor: { id: string; ip?: string | null },
): Promise<void> {
  const parsed = settingSchemas[key].parse(value) as Prisma.InputJsonValue;
  await db.setting.upsert({
    where: { key },
    create: { key, value: parsed, updatedById: actor.id },
    update: { value: parsed, updatedById: actor.id },
  });
  await audit({ actorId: actor.id, action: "settings.update", entity: "Setting", entityId: key, ipAddress: actor.ip });
}
