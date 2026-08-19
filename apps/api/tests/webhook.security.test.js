import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import request from "supertest";
import { createTestSystem, validLead } from "../../../tests/support.js";

const signedPayload = (secret, payload) => {
  const body = JSON.stringify(payload);
  return { body, signature: `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}` };
};

test("WhatsApp webhook verification and HMAC signature are enforced and statuses never regress", async () => {
  const system = await createTestSystem();
  try {
    const key = crypto.randomUUID();
    let submission = request(system.app).post("/api/leads").set("Idempotency-Key", key);
    for (const [name, value] of Object.entries(validLead())) submission = submission.field(name, value);
    assert.equal((await submission).status, 201);
    await system.runner.run();
    const delivery = await system.prisma.whatsAppDelivery.findFirstOrThrow();
    assert.ok(delivery.metaMessageId);
    assert.equal((await request(system.app).get("/webhooks/whatsapp").query({ "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "x" })).status, 403);
    assert.equal((await request(system.app).post("/webhooks/whatsapp").set("Content-Type", "application/json").send({})).status, 401);
    const payload = { entry: [{ changes: [{ value: { statuses: [{ id: delivery.metaMessageId, status: "delivered", timestamp: "100" }] } }] }] };
    const signed = signedPayload(system.config.whatsapp.appSecret, payload);
    assert.equal((await request(system.app).post("/webhooks/whatsapp").set("Content-Type", "application/json").set("X-Hub-Signature-256", signed.signature).send(signed.body)).status, 200);
    const replay = signedPayload(system.config.whatsapp.appSecret, { entry: [{ changes: [{ value: { statuses: [{ id: delivery.metaMessageId, status: "sent", timestamp: "99" }] } }] }] });
    assert.equal((await request(system.app).post("/webhooks/whatsapp").set("Content-Type", "application/json").set("X-Hub-Signature-256", replay.signature).send(replay.body)).status, 200);
    assert.equal((await system.prisma.whatsAppDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).status, "DELIVERED");
  } finally { await system.close(); }
});
