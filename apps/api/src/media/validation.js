import crypto from "node:crypto";
import fs from "node:fs";
import { fileTypeFromFile } from "file-type";

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export class MediaValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "MediaValidationError";
  }
}

export function validateFileCounts(files) {
  const location = files.locationPhotos || [];
  const inspiration = files.inspirationPhotos || [];
  if (location.length > 3 || inspiration.length > 2 || location.length + inspiration.length > 5) {
    throw new MediaValidationError("Demasiadas imagens.");
  }
}

export async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

export async function describeUploads(files, config) {
  validateFileCounts(files);
  const described = [];
  for (const [category, list] of [["LOCATION", files.locationPhotos || []], ["INSPIRATION", files.inspirationPhotos || []]]) {
    for (let position = 0; position < list.length; position += 1) {
      const file = list[position];
      if (file.size > config.maxFileBytes) throw new MediaValidationError("Cada imagem deve ter no máximo 5 MB.");
      described.push({ file, category, position, rawSha256: await sha256File(file.path) });
    }
  }
  return described;
}

export async function validateImageFile(file, config) {
  if (file.size > config.maxFileBytes) throw new MediaValidationError("Cada imagem deve ter no máximo 5 MB.");
  const detected = await fileTypeFromFile(file.path);
  if (!detected || !acceptedTypes.has(detected.mime)) throw new MediaValidationError("Formato de imagem inválido.");
  return detected.mime;
}
