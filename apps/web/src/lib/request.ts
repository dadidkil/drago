import "server-only";
import { headers } from "next/headers";

/**
 * IP клиента. Приложение доступно только через Caddy, который перезаписывает
 * X-Forwarded-For адресом реального клиента (входящие XFF от недоверенных клиентов игнорируются).
 */
export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim().slice(0, 64);
  return h.get("x-real-ip")?.slice(0, 64) ?? null;
}

export async function getUserAgent(): Promise<string | null> {
  return (await headers()).get("user-agent")?.slice(0, 300) ?? null;
}

export async function getNonce(): Promise<string | undefined> {
  return (await headers()).get("x-nonce") ?? undefined;
}
