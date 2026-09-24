import { db } from "@drago/database";
import { getCurrentUser } from "@/lib/auth/current-user";
import { readStoredFile } from "@/lib/uploads";

/**
 * Внутренние файлы (документы, вложения, аватары). Доступ проверяется по сущности-владельцу:
 * документ — уровень роли ≥ max(категория, документ); вложение объявления — аудитория объявления;
 * вложение задачи — исполнитель/автор/tasks.manage; аватар — любой авторизованный.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return new Response("Not found", { status: 404 });

  const asset = await db.fileAsset.findUnique({
    where: { id },
    include: {
      document: { include: { category: { select: { minRoleLevel: true } } } },
      announcement: { select: { minRoleLevel: true } },
      task: { select: { createdById: true, assignees: { select: { userId: true } } } },
      profileAvatar: { select: { userId: true } },
    },
  });
  if (!asset) return new Response("Not found", { status: 404 });

  let allowed = false;
  if (asset.visibility === "PUBLIC") allowed = true;
  else if (asset.document) {
    const required = Math.max(asset.document.category.minRoleLevel, asset.document.minRoleLevel ?? 0);
    allowed = user.level >= required || user.can("documents.manage");
  } else if (asset.announcement) {
    allowed = user.level >= asset.announcement.minRoleLevel || user.can("announcements.manage");
  } else if (asset.task) {
    allowed =
      asset.task.createdById === user.id || asset.task.assignees.some((a) => a.userId === user.id) || user.can("tasks.manage");
  } else if (asset.profileAvatar) {
    allowed = true;
  } else {
    allowed = asset.uploadedById === user.id || user.can("settings.manage");
  }
  // Не раскрываем существование файла без прав.
  if (!allowed) return new Response("Not found", { status: 404 });

  try {
    const data = await readStoredFile(asset.storageKey);
    const inline = asset.mimeType.startsWith("image/") || asset.mimeType === "application/pdf";
    const encoded = encodeURIComponent(asset.originalName);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(data.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="file"; filename*=UTF-8''${encoded}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
