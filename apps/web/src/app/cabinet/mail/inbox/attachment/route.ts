import { mailboxAccess, readAttachment } from "@drago/core";
import { getCurrentUser } from "@/lib/auth/current-user";

/** Скачивание вложения из письма своего ящика. Доступ — только владельцу ящика (по сессии кабинета). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const uid = Number(url.searchParams.get("uid"));
  const index = Number(url.searchParams.get("i"));
  if (!Number.isInteger(uid) || uid <= 0 || !Number.isInteger(index) || index < 0 || index > 100) return new Response("Bad request", { status: 400 });
  const access = await mailboxAccess(user.id);
  if (!access.ok) return new Response(access.message, { status: 404 });
  const file = await readAttachment(access.creds, uid, index).catch(() => null);
  if (!file) return new Response("Not found", { status: 404 });
  const name = file.filename.replace(/[\r\n"]/g, "_");
  return new Response(new Uint8Array(file.content), {
    headers: {
      // Вложения из интернета не открываем в контексте сайта: только скачивание.
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
