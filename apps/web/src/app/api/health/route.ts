import { db } from "@drago/database";

export const dynamic = "force-dynamic";

/** Healthcheck для Docker/Caddy: процесс жив и БД отвечает. Без подробностей наружу. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "error" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
