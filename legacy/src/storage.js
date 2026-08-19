import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { config } from "./config.js";

const accepted = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
export const sanitizeFilename = (name) => path.basename(name).normalize("NFKC").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "imagem";

export async function processImage(file, category) {
  if (file.size > 5 * 1024 * 1024) throw new Error("Cada imagem deve ter no máximo 5 MB.");
  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected || !accepted.has(detected.mime)) throw new Error("Formato de imagem inválido.");
  const sha256 = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const id = crypto.randomUUID();
  const folder = category === "LOCATION" ? "location" : "inspiration";
  const relative = path.join("uploads", folder, `${id}.webp`);
  const thumbRelative = path.join("thumbs", folder, `${id}.webp`);
  const target = path.join(config.storageRoot, relative);
  const thumb = path.join(config.storageRoot, thumbRelative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.mkdir(path.dirname(thumb), { recursive: true });
  const pipeline = sharp(file.buffer, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
  const meta = await pipeline.metadata();
  if (!meta.width || !meta.height) throw new Error("Não foi possível ler a imagem.");
  await pipeline.clone().webp({ quality: 84 }).toFile(target);
  await pipeline.clone().resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true }).webp({ quality: 76 }).toFile(thumb);
  return {
    category,
    originalNameSanitized: sanitizeFilename(file.originalname),
    storageKey: relative.replaceAll("\\", "/"),
    thumbnailStorageKey: thumbRelative.replaceAll("\\", "/"),
    mimeType: "image/webp",
    sizeBytes: file.size,
    width: meta.width,
    height: meta.height,
    sha256
  };
}

export async function removeProcessed(files) {
  await Promise.all(files.flatMap((f) => [f.storageKey, f.thumbnailStorageKey].map((key) =>
    fs.rm(path.join(config.storageRoot, key), { force: true }).catch(() => {}))));
}
