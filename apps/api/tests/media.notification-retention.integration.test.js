import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { runCleanup } from "../src/maintenance/cleanup.js";
import { createTestSystem, seedLegacyWhatsAppSummary } from "../../../tests/support.js";

async function addLegacyImage(system, submissionId) {
  const mediaId = crypto.randomUUID();
  const storageKey = crypto.randomUUID() + ".jpg";
  const filePath = path.join(system.config.storageRoot, storageKey);
  await fs.writeFile(filePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  await system.prisma.leadMedia.create({
    data: {
      id: mediaId, leadSubmissionId: submissionId, category: "LOCATION", position: 0,
      storageKey, mimeType: "image/jpeg", sizeBytes: 4, width: 1, height: 1,
      sha256: "a".repeat(64), status: "READY"
    }
  });
  await system.prisma.whatsAppDelivery.create({
    data: {
      id: crypto.randomUUID(), leadSubmissionId: submissionId, leadMediaId: mediaId,
      dedupeKey: submissionId + ":image:1", sequence: 1, kind: "IMAGE",
      destinationPhoneE164: "258000000000"
    }
  });
  return { mediaId, filePath };
}

test("legacy runner and cleanup preserve image evidence when a B3 email outbox exists", async () => {
  const system = await createTestSystem();
  try {
    const summary = await seedLegacyWhatsAppSummary(system);
    const caseRecord = await system.prisma.case.findFirstOrThrow({ where: { sourceLeadSubmissionId: summary.leadSubmissionId } });
    const media = await addLegacyImage(system, summary.leadSubmissionId);
    await system.prisma.notificationDelivery.create({
      data: {
        id: crypto.randomUUID(), leadSubmissionId: summary.leadSubmissionId, caseId: caseRecord.id,
        dedupeKey: summary.leadSubmissionId + ":lead-internal-email:v1",
        channel: "EMAIL", kind: "LEAD_INTERNAL", provider: "FAKE", destination: "office@solima.test"
      }
    });

    // Explicit test invocation: production startup must not run fake legacy delivery when Meta is disabled.
    await system.legacyRunner.run();
    assert.equal(await system.prisma.whatsAppDelivery.count({ where: { status: "ACCEPTED" } }), 2);
    await fs.access(media.filePath);
    assert.equal((await system.prisma.leadMedia.findUniqueOrThrow({ where: { id: media.mediaId } })).localDeletedAt, null);
    assert.equal(await system.repository.canDeleteLegacyMedia(media.mediaId), false);

    await runCleanup({ prisma: system.prisma, config: system.config, logger: { info() {} } });
    await fs.access(media.filePath);
    assert.equal((await system.prisma.leadMedia.findUniqueOrThrow({ where: { id: media.mediaId } })).status, "READY");
  } finally { await system.close(); }
});

test("old Meta-only image delivery retains historical deletion behavior when no B3 email references the lead", async () => {
  const system = await createTestSystem();
  try {
    const summary = await seedLegacyWhatsAppSummary(system);
    const media = await addLegacyImage(system, summary.leadSubmissionId);
    assert.equal(await system.repository.canDeleteLegacyMedia(media.mediaId), true);
    await system.legacyRunner.run();
    const after = await system.prisma.leadMedia.findUniqueOrThrow({ where: { id: media.mediaId } });
    assert.equal(after.status, "DELETED");
    assert.notEqual(after.localDeletedAt, null);
    await assert.rejects(fs.access(media.filePath));
  } finally { await system.close(); }
});
