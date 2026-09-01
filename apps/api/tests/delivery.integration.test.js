import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import request from "supertest";
import { FakeEmailAdapter } from "../src/email/adapter.js";
import { EmailProviderError } from "../src/email/errors.js";
import { createTestSystem, seedLegacyWhatsAppSummary, validLead } from "../../../tests/support.js";

const postLead = (app, key = crypto.randomUUID(), overrides = {}) => {
  let result = request(app).post("/api/leads").set("Idempotency-Key", key);
  for (const [name, value] of Object.entries({ ...validLead(), ...overrides })) result = result.field(name, value);
  return result;
};

test("a permanent email provider error becomes terminal without an infinite retry", async () => {
  const adapter = new FakeEmailAdapter({ failures: [new EmailProviderError("Rejected", { code: "smtp_550", retryable: false })] });
  const system = await createTestSystem({ emailAdapter: adapter });
  try {
    assert.equal((await postLead(system.app)).status, 201);
    await system.runner.run();
    const delivery = await system.prisma.notificationDelivery.findFirstOrThrow();
    assert.equal(delivery.status, "FAILED");
    assert.equal(delivery.attempts, 1);
    assert.equal(await system.prisma.leadSubmission.count(), 1);
    assert.equal(await system.prisma.case.count(), 1);
  } finally { await system.close(); }
});

test("stale email PROCESSING work is recovered instead of remaining stuck", async () => {
  const system = await createTestSystem();
  try {
    system.runner.stopped = true;
    assert.equal((await postLead(system.app)).status, 201);
    const delivery = await system.prisma.notificationDelivery.findFirstOrThrow();
    await system.prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: "PROCESSING", processingStartedAt: new Date(Date.now() - 10 * 60_000) } });
    assert.equal((await system.notificationRepository.recoverStaleProcessing(new Date(Date.now() - 5 * 60_000))).count, 1);
    assert.equal((await system.prisma.notificationDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).status, "RETRY");
  } finally { await system.close(); }
});

test("email runner drains a durable backlog without waiting for recovery interval", async () => {
  const system = await createTestSystem();
  try {
    system.runner.stopped = true;
    for (let index = 0; index < 11; index += 1) assert.equal((await postLead(system.app)).status, 201);
    system.runner.stopped = false;
    await system.runner.run();
    assert.equal(system.adapter.calls.length, 11);
    assert.equal(await system.prisma.notificationDelivery.count({ where: { status: "SENT" } }), 11);
  } finally { await system.close(); }
});

test("email renders escaped HTML, plain text and server-owned headers", async () => {
  const system = await createTestSystem();
  try {
    assert.equal((await postLead(system.app, crypto.randomUUID(), { notes: "Medida especial & urgente" })).status, 201);
    await system.runner.run();
    const message = system.adapter.calls[0];
    assert.equal(message.to, "office@solima.test");
    assert.equal(message.from, "notifications@solima.test");
    assert.match(message.subject, /^SOLIMA — novo pedido SOL-C-/);
    assert.match(message.text, /Medida especial & urgente/);
    assert.match(message.html, /Medida especial &amp; urgente/);
    assert.doesNotMatch(message.html, /Medida especial & urgente/);
  } finally { await system.close(); }
});

test("legacy WhatsApp outbox and runner remain operational but receive no new form deliveries", async () => {
  const system = await createTestSystem();
  try {
    await seedLegacyWhatsAppSummary(system);
    await system.legacyRunner.run();
    assert.equal(await system.prisma.whatsAppDelivery.count({ where: { status: "ACCEPTED" } }), 1);
    assert.equal(system.whatsappAdapter.calls.filter((call) => call.operation === "summary").length, 1);
    assert.equal((await postLead(system.app)).status, 201);
    assert.equal(await system.prisma.whatsAppDelivery.count(), 1);
    assert.equal(await system.prisma.notificationDelivery.count(), 1);
  } finally { await system.close(); }
});
