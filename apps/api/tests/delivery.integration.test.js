import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import sharp from "sharp";
import { FakeWhatsAppAdapter } from "../src/whatsapp/adapter.js";
import { ProviderError } from "../src/whatsapp/errors.js";
import { createTestSystem, validLead } from "../../../tests/support.js";

const postLead = (app, key = crypto.randomUUID()) => {
  let result = request(app).post("/api/leads").set("Idempotency-Key", key);
  for (const [name, value] of Object.entries(validLead())) result = result.field(name, value);
  return result;
};

test("a permanent provider error becomes terminal without an infinite retry", async () => {
  const adapter = new FakeWhatsAppAdapter();
  adapter.queueFailure("summary", new ProviderError("Invalid template", { code: "invalid_template", retryable: false }));
  const system = await createTestSystem({ adapter });
  try {
    assert.equal((await postLead(system.app)).status, 201);
    await system.runner.run();
    const delivery = await system.prisma.whatsAppDelivery.findFirstOrThrow();
    assert.equal(delivery.status, "FAILED");
    assert.equal(delivery.attempts, 1);
  } finally { await system.close(); }
});

test("a failed image delivery retains local media for retry and preserves sequence", async () => {
  const adapter = new FakeWhatsAppAdapter();
  adapter.queueFailure("image", new ProviderError("429", { code: "meta_429", retryable: true }));
  const system = await createTestSystem({ adapter });
  try {
    const image = await sharp({ create: { width: 30, height: 30, channels: 3, background: "#22c7e8" } }).jpeg().toBuffer();
    const response = await postLead(system.app).attach("locationPhotos", image, { filename: "site.jpg", contentType: "image/jpeg" });
    assert.equal(response.status, 201);
    await system.runner.run();
    const deliveries = await system.prisma.whatsAppDelivery.findMany({ orderBy: { sequence: "asc" } });
    const media = await system.prisma.leadMedia.findFirstOrThrow();
    assert.deepEqual(deliveries.map((delivery) => delivery.status), ["ACCEPTED", "RETRY"]);
    await fs.access(path.join(system.config.storageRoot, media.storageKey));
  } finally { await system.close(); }
});

test("stale PROCESSING work is returned to recovery instead of remaining stuck", async () => {
  const system = await createTestSystem();
  try {
    system.runner.stopped = true;
    assert.equal((await postLead(system.app)).status, 201);
    const delivery = await system.prisma.whatsAppDelivery.findFirstOrThrow();
    await system.prisma.whatsAppDelivery.update({ where: { id: delivery.id }, data: { status: "PROCESSING", processingStartedAt: new Date(Date.now() - 10 * 60_000) } });
    assert.equal((await system.repository.recoverStaleProcessing(new Date(Date.now() - 5 * 60_000))).count, 1);
    assert.equal((await system.prisma.whatsAppDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).status, "RETRY");
  } finally { await system.close(); }
});

test("runner drains a ready durable backlog instead of waiting for the recovery interval", async () => {
  const system = await createTestSystem();
  try {
    system.runner.stopped = true;
    for (let index = 0; index < 11; index += 1) {
      assert.equal((await postLead(system.app)).status, 201);
    }
    system.runner.stopped = false;
    await system.runner.run();
    assert.equal(system.adapter.calls.filter((call) => call.operation === "summary").length, 11);
    assert.equal(await system.prisma.whatsAppDelivery.count({ where: { status: "ACCEPTED" } }), 11);
  } finally { await system.close(); }
});
