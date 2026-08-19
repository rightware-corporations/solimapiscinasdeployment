import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../config/env.js";
import { createPrisma } from "../db/prisma.js";
import { createLogger } from "../lib/logger.js";
import { storagePath } from "../media/local-storage.js";

export async function runCleanup({ prisma, config, logger }) {
  const now = Date.now();
  const accepted = await prisma.leadMedia.findMany({
    where: { localDeletedAt: null, delivery: { is: { status: { in: ["ACCEPTED", "SENT", "DELIVERED", "READ"] } } } }
  });
  const failed = await prisma.leadMedia.findMany({
    where: { localDeletedAt: null, delivery: { is: { status: "FAILED", failedAt: { lt: new Date(now - config.mediaRetentionHours * 3_600_000) } } } }
  });
  for (const media of [...accepted, ...failed]) {
    await fs.rm(storagePath(config, media.storageKey), { force: true });
    await prisma.leadMedia.update({ where: { id: media.id }, data: { localDeletedAt: new Date(), status: "DELETED" } });
  }
  const rawEntries = await fs.readdir(config.rawUploadRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of rawEntries) {
    if (!entry.isFile()) continue;
    const filePath = path.join(config.rawUploadRoot, entry.name);
    const stat = await fs.stat(filePath).catch(() => null);
    if (stat && stat.mtimeMs < now - 3_600_000) await fs.rm(filePath, { force: true });
  }
  logger.info("cleanup.completed", { acceptedMedia: accepted.length, failedMedia: failed.length });
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll("\\", "/")}`) {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel });
  const prisma = createPrisma(config);
  try { await runCleanup({ prisma, config, logger }); } finally { await prisma.$disconnect(); }
}
