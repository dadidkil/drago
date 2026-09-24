import { db } from "@drago/database";
import { readStoredFile } from "@/lib/uploads";

/** Публичные медиафайлы (фото галереи, обложки, фото командного состава). Только visibility = PUBLIC. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return new Response("Not found", { status: 404 });
  const asset = await db.fileAsset.findUnique({ where: { id }, select: { storageKey: true, mimeType: true, visibility: true, sha256: true } });
  if (!asset || asset.visibility !== "PUBLIC" || !asset.mimeType.startsWith("image/")) return new Response("Not found", { status: 404 });
  try {
    const data = await readStoredFile(asset.storageKey);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(data.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: `"${asset.sha256.slice(0, 32)}"`,
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
        "Cross-Origin-Resource-Policy": "same-site",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
