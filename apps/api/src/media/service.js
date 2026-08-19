import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { validateImageFile, MediaValidationError } from "./validation.js";

sharp.concurrency(1);

export async function processImages(describedUploads, config, logger) {
  const staged = [];
  try {
    await fs.mkdir(config.storageRoot, { recursive: true });
    for (const item of describedUploads) {
      const started = performance.now();
      await validateImageFile(item.file, config);
      const id = crypto.randomUUID();
      const storageKey = `${id}.jpg`;
      const target = path.join(config.storageRoot, storageKey);
      const pipeline = sharp(item.file.path, { failOn: "error", limitInputPixels: config.maxImagePixels, sequentialRead: true })
        .rotate()
        .resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true });
      await pipeline.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(target);
      let info = await fs.stat(target);
      if (info.size > 4_500_000) {
        await pipeline.clone().resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 72, mozjpeg: true }).toFile(target);
        info = await fs.stat(target);
      }
      const metadata = await sharp(target, { failOn: "error" }).metadata();
      if (!metadata.width || !metadata.height || info.size === 0) throw new MediaValidationError("Não foi possível processar a imagem.");
      const processed = {
        id,
        category: item.category,
        position: item.position,
        storageKey,
        mimeType: "image/jpeg",
        sizeBytes: info.size,
        width: metadata.width,
        height: metadata.height,
        sha256: item.rawSha256,
        status: "READY"
      };
      staged.push(processed);
      logger.info("media.processed", { mediaId: id, durationMs: Math.round(performance.now() - started), inputBytes: item.file.size, processedBytes: info.size });
    }
    return staged;
  } catch (error) {
    await Promise.all(staged.map((item) => fs.rm(path.join(config.storageRoot, item.storageKey), { force: true }).catch(() => {})));
    if (error instanceof MediaValidationError || /image|Input|corrupt|pixel/i.test(String(error.message))) {
      throw new MediaValidationError("Imagem inválida, corrompida ou demasiado grande.");
    }
    throw error;
  }
}
