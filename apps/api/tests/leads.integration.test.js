import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import sharp from "sharp";
import { ProviderError } from "../src/whatsapp/errors.js";
import { FakeWhatsAppAdapter } from "../src/whatsapp/adapter.js";
import { createTestSystem, validLead } from "../../../tests/support.js";

const submit = (app, key, values = validLead()) => {
  let result = request(app).post("/api/leads").set("Idempotency-Key", key);
  for (const [name, value] of Object.entries(values)) result = result.field(name, value);
  return result;
};

test("accepts one durable lead and replays the same submission without a second delivery", async () => {
  const system = await createTestSystem();
  try {
    const key = crypto.randomUUID();
    const first = await submit(system.app, key);
    const replay = await submit(system.app, key);
    assert.equal(first.status, 201);
    assert.equal(replay.status, 200);
    await system.runner.run();
    assert.equal(await system.prisma.leadSubmission.count(), 1);
    assert.equal(await system.prisma.whatsAppDelivery.count(), 1);
    assert.equal(system.adapter.calls.filter((call) => call.operation === "summary").length, 1);
  } finally { await system.close(); }
});

test("rejects malformed extras and an idempotency key reused with a different payload", async () => {
  const system = await createTestSystem();
  try {
    const malformed = await submit(system.app, crypto.randomUUID(), { ...validLead(), extras: "[" });
    assert.equal(malformed.status, 422);
    const key = crypto.randomUUID();
    assert.equal((await submit(system.app, key)).status, 201);
    const conflict = await submit(system.app, key, { ...validLead(), location: "Matola" });
    assert.equal(conflict.status, 409);
  } finally { await system.close(); }
});

test("concurrent identical requests create one logical lead", async () => {
  const system = await createTestSystem();
  try {
    const key = crypto.randomUUID();
    const responses = await Promise.all([submit(system.app, key), submit(system.app, key)]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
    assert.equal(await system.prisma.leadSubmission.count(), 1);
  } finally { await system.close(); }
});

test("processes an image to JPEG and deletes it only after the fake provider accepts its message", async () => {
  const system = await createTestSystem();
  try {
    const image = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#22c7e8" } }).png().toBuffer();
    const response = await submit(system.app, crypto.randomUUID()).attach("locationPhotos", image, { filename: "site.png", contentType: "image/png" });
    assert.equal(response.status, 201);
    await system.runner.run();
    const media = await system.prisma.leadMedia.findFirstOrThrow();
    assert.equal(media.mimeType, "image/jpeg");
    assert.ok(media.localDeletedAt);
    await assert.rejects(fs.access(path.join(system.config.storageRoot, media.storageKey)));
    assert.equal(system.adapter.calls.filter((call) => call.operation === "image").length, 1);
  } finally { await system.close(); }
});

test("a temporary provider failure remains durable and becomes retryable", async () => {
  const adapter = new FakeWhatsAppAdapter();
  adapter.queueFailure("summary", new ProviderError("Timeout", { code: "timeout", retryable: true }));
  const system = await createTestSystem({ adapter });
  try {
    assert.equal((await submit(system.app, crypto.randomUUID())).status, 201);
    await system.runner.run();
    const delivery = await system.prisma.whatsAppDelivery.findFirstOrThrow();
    assert.equal(delivery.status, "RETRY");
    assert.equal(delivery.attempts, 1);
  } finally { await system.close(); }
});
