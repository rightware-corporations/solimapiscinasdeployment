import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { runCleanup } from "../src/maintenance/cleanup.js";
import { createTestSystem } from "../../../tests/support.js";

test("cleanup removes only expired processed files that have no durable media record", async () => {
  const system = await createTestSystem();
  try {
    const expiredKey = `${crypto.randomUUID()}.jpg`;
    const recentKey = `${crypto.randomUUID()}.jpg`;
    const expiredPath = path.join(system.config.storageRoot, expiredKey);
    const recentPath = path.join(system.config.storageRoot, recentKey);
    await fs.writeFile(expiredPath, "orphan");
    await fs.writeFile(recentPath, "recent");
    const expiredAt = new Date(Date.now() - (system.config.mediaRetentionHours + 1) * 3_600_000);
    await fs.utimes(expiredPath, expiredAt, expiredAt);

    await runCleanup({ prisma: system.prisma, config: system.config, logger: { info() {} } });

    await assert.rejects(fs.access(expiredPath));
    await fs.access(recentPath);
  } finally { await system.close(); }
});
