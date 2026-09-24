import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { db, type FileVisibility } from "@drago/database";
import { UserError } from "./actions";

export type UploadKind = "image" | "document" | "attachment";

const MB = 1024 * 1024;
const LIMITS: Record<UploadKind, number> = { image: 15 * MB, document: 25 * MB, attachment: 15 * MB };

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
]);

export function uploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
}

/** Путь к файлу внутри UPLOAD_DIR с защитой от path traversal. */
export function resolveStoragePath(storageKey: string): string {
  const root = uploadDir();
  const full = path.resolve(root, storageKey);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
}

function safeOriginalName(name: string): string {
  const base = path.basename(name).replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "_").trim();
  return (base || "file").slice(0, 150);
}

/**
 * Приём файла: лимит размера → определение типа по сигнатуре (а не по расширению/заявленному MIME)
 * → белый список → изображения перекодируются (убираются EXIF/GPS-метаданные — важно для фото подростков)
 * → сохранение под случайным именем.
 */
export async function storeUpload(
  file: File,
  opts: { kind: UploadKind; visibility: FileVisibility; uploadedById: string },
) {
  if (!(file instanceof File) || file.size === 0) throw new UserError("Файл не выбран");
  if (file.size > LIMITS[opts.kind]) throw new UserError(`Файл больше ${Math.round(LIMITS[opts.kind] / MB)} МБ`);

  const input = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(input);
  const mime = detected?.mime ?? "application/octet-stream";

  const allowImages = opts.kind === "image" || opts.kind === "attachment" || opts.kind === "document";
  const allowDocs = opts.kind === "document" || opts.kind === "attachment";
  const isImage = IMAGE_TYPES.has(mime) && allowImages;
  const isDoc = DOCUMENT_TYPES.has(mime) && allowDocs;
  if (!isImage && !isDoc) {
    throw new UserError(
      opts.kind === "image"
        ? "Допустимы изображения JPEG, PNG, WebP, AVIF"
        : "Допустимы PDF, документы Office/OpenDocument (DOCX, XLSX, PPTX, ODT…) и изображения",
    );
  }

  let output: Buffer = input;
  let outMime = mime;
  let ext = detected?.ext ?? "bin";
  let width: number | null = null;
  let height: number | null = null;

  if (isImage) {
    try {
      const { data, info } = await sharp(input, { limitInputPixels: 80_000_000 })
        .rotate()
        .resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
      output = data;
      width = info.width;
      height = info.height;
      outMime = "image/webp";
      ext = "webp";
    } catch {
      throw new UserError("Не удалось обработать изображение");
    }
  }

  const now = new Date();
  const storageKey = path.posix.join(
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${randomUUID()}.${ext}`,
  );
  const full = resolveStoragePath(storageKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, output, { mode: 0o640 });

  const originalName = isImage
    ? safeOriginalName(file.name).replace(/\.[a-z0-9]+$/i, "") + ".webp"
    : safeOriginalName(file.name);

  return db.fileAsset.create({
    data: {
      storageKey,
      originalName,
      mimeType: outMime,
      size: output.length,
      sha256: createHash("sha256").update(output).digest("hex"),
      width,
      height,
      visibility: opts.visibility,
      uploadedById: opts.uploadedById,
    },
  });
}

export async function readStoredFile(storageKey: string): Promise<Buffer> {
  return readFile(resolveStoragePath(storageKey));
}

/** Удаляет запись и файл. */
export async function deleteFileAsset(id: string): Promise<void> {
  const asset = await db.fileAsset.findUnique({ where: { id } });
  if (!asset) return;
  await db.fileAsset.delete({ where: { id } });
  await rm(resolveStoragePath(asset.storageKey), { force: true });
}

export function mediaUrl(fileId: string | null | undefined): string | null {
  return fileId ? `/media/${fileId}` : null;
}

export function fileUrl(fileId: string): string {
  return `/api/files/${fileId}`;
}
