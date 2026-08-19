import crypto from "node:crypto";
import fs from "node:fs";
import multer from "multer";

export function createUpload(config) {
  fs.mkdirSync(config.rawUploadRoot, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: config.rawUploadRoot,
      filename: (_req, _file, callback) => callback(null, crypto.randomUUID())
    }),
    limits: { fileSize: config.maxFileBytes, files: 7, fields: 20, fieldSize: 16_000, parts: 30 }
  });
}
