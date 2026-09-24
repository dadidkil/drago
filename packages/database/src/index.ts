import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

export * from "./generated/prisma/client";

const globalForPrisma = globalThis as unknown as { __dragoPrisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL не задан");
  }
  const adapter = new PrismaPg({ connectionString, max: Number(process.env.DATABASE_POOL_SIZE ?? 10) });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/**
 * Единственный экземпляр Prisma Client на процесс.
 * В dev-режиме Next.js переживает hot reload через globalThis.
 * Клиент создаётся лениво — сборка Next.js не требует DATABASE_URL.
 */
export function getDb(): PrismaClient {
  if (!globalForPrisma.__dragoPrisma) {
    globalForPrisma.__dragoPrisma = createClient();
  }
  return globalForPrisma.__dragoPrisma;
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getDb();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
