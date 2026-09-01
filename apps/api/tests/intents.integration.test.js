import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestSystem } from "../../../tests/support.js";

test("creates a server-resolved WhatsApp intent without claiming conversion", async () => {
  const system = await createTestSystem();
  try {
    const response = await request(system.app).post("/api/intents/whatsapp").send({ sourceType: "PROJECT", sourceRef: "vista-do-vale", ctaType: "WHATSAPP_CHAT" });
    assert.equal(response.status, 201);
    assert.match(response.body.referenceCode, /^SOL-I-[A-Z0-9_-]{11}$/);
    const intent = await system.prisma.intent.findUniqueOrThrow({ where: { referenceCode: response.body.referenceCode } });
    assert.equal(intent.channel, "WHATSAPP");
    assert.equal(intent.sourceNameSnapshot, "Vista do Vale");
    assert.equal(intent.suggestedService, "NEW_CONSTRUCTION");
    assert.equal(intent.convertedAt, null);
    const redirect = new URL(response.body.redirectUrl);
    assert.equal(redirect.hostname, "wa.me");
    assert.equal(redirect.pathname, "/258843892558");
    assert.match(redirect.searchParams.get("text"), new RegExp(response.body.referenceCode));
  } finally { await system.close(); }
});

test("rejects unknown, forged and structurally invalid intent context", async () => {
  const system = await createTestSystem();
  try {
    assert.equal((await request(system.app).post("/api/intents/whatsapp").send({ sourceType: "PROJECT", sourceRef: "inventado", ctaType: "WHATSAPP_CHAT" })).status, 422);
    assert.equal((await request(system.app).post("/api/intents/whatsapp").send({ sourceType: "CONTACT", ctaType: "WHATSAPP_CHAT", destination: "258000000000" })).status, 422);
    assert.equal((await request(system.app).post("/api/intents/whatsapp").send({ sourceType: "PROJECT", sourceRef: "vista-do-vale", sourceNameSnapshot: "Forged", ctaType: "WHATSAPP_CHAT" })).status, 422);
    assert.equal(await system.prisma.intent.count(), 0);
  } finally { await system.close(); }
});

test("creates unique references without affecting leads or deliveries", async () => {
  const system = await createTestSystem();
  try {
    const payload = { sourceType: "CONTACT", ctaType: "WHATSAPP_CHAT" };
    const [first, second] = await Promise.all([request(system.app).post("/api/intents/whatsapp").send(payload), request(system.app).post("/api/intents/whatsapp").send(payload)]);
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.notEqual(first.body.referenceCode, second.body.referenceCode);
    assert.equal(await system.prisma.intent.count(), 2);
    assert.equal(await system.prisma.leadSubmission.count(), 0);
    assert.equal(await system.prisma.whatsAppDelivery.count(), 0);
  } finally { await system.close(); }
});
