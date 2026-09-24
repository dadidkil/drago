import { db, type Prisma } from "@drago/database";
import { createLogger } from "./logger";

const log = createLogger("audit");

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  ipAddress?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Запись в журнал аудита. Никогда не пишем сюда пароли, токены и прочие секреты.
 * Ошибка записи аудита не должна ломать основное действие, но логируется.
 */
export async function audit(entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
  try {
    await (tx ?? db).auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        ipAddress: entry.ipAddress ?? null,
        metadata: entry.metadata ?? undefined,
      },
    });
  } catch (err) {
    log.error("audit write failed", { err, action: entry.action });
    if (tx) throw err;
  }
}
