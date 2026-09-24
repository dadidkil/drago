import { db } from "@drago/database";

export const dynamic = "force-dynamic";

/**
 * Healthcheck для Docker/Caddy/nginx: процесс жив и БД отвечает. Без подробностей наружу.
 * Поле app позволяет скриптам деплоя убедиться, что на порту отвечает именно «Драго»,
 * а не другое приложение на том же сервере.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", app: "drago" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "error" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
