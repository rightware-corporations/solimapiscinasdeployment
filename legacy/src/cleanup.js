import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { config } from "./config.js";
const prisma = new PrismaClient();
const cutoff = new Date(Date.now() - config.retentionDays * 86_400_000);
const old = await prisma.quoteRequest.findMany({ where: { createdAt: { lt: cutoff }, status: { in: ["REJECTED", "CLOSED"] } }, include: { files: true } });
for (const request of old) {
  await Promise.all(request.files.flatMap((f) => [f.storageKey, f.thumbnailStorageKey].map((key) => fs.rm(path.join(config.storageRoot, key), { force: true }))));
  await prisma.quoteRequest.delete({ where: { id: request.id } });
}
console.log(`Removed ${old.length} expired request(s).`);
await prisma.$disconnect();
