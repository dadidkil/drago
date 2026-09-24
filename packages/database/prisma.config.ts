import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 не читает .env сам: подхватываем корневой .env (для локальной разработки).
loadEnv({ path: path.resolve(import.meta.dirname, "../../.env"), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx src/seed.ts",
  },
  datasource: {
    // Для `prisma generate` URL не нужен — подставляем заглушку.
    url: process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
