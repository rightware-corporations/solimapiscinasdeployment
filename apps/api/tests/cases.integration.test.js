import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import request from "supertest";
import { createTestSystem } from "../../../tests/support.js";

const formLead = (app, key) => request(app).post("/api/leads")
  .set("Idempotency-Key", key)
  .field("customerName", "Ana Manjate").field("phone", "824407120")
  .field("location", "Maputo").field("serviceType", "NEW_CONSTRUCTION")
  .field("extras", "[]").field("notes", "Piscina familiar")
  .field("consentGiven", "true").field("startedAt", String(Date.now() - 5_000)).field("website", "");

test("FORM creates one SALES Case atomically with the submission", async () => {
  const system = await createTestSystem();
  try {
    assert.equal((await formLead(system.app, crypto.randomUUID())).status, 201);
    const submission = await system.prisma.leadSubmission.findFirstOrThrow();
    const operationalCase = await system.prisma.case.findUniqueOrThrow({ where: { sourceLeadSubmissionId: submission.id } });
    assert.equal(operationalCase.type, "SALES");
    assert.equal(operationalCase.channel, "FORM");
    assert.equal(operationalCase.customerNameSnapshot, submission.customerName);
    assert.equal(operationalCase.workflowState, "NEW");
    assert.match(operationalCase.publicReference, /^SOL-C-[A-Z0-9_-]{11}$/);
  } finally { await system.close(); }
});

test("a WhatsApp Intent can be associated manually with exactly one Case", async () => {
  const system = await createTestSystem();
  try {
    const intentResponse = await request(system.app).post("/api/intents/whatsapp").send({ sourceType: "PROJECT", sourceRef: "vista-do-vale", ctaType: "WHATSAPP_CHAT" });
    const input = {
      sourceIntentReference: intentResponse.body.referenceCode,
      customerName: "Ana Manjate", phone: "824407120", location: "Maputo",
      serviceType: "NEW_CONSTRUCTION", title: "Pedido recebido no WhatsApp",
      description: "Cliente iniciou conversa humana.", createdByUserId: "test-staff"
    };
    const operationalCase = await system.caseService.createManualWhatsappCase(input);
    assert.equal(operationalCase.channel, "WHATSAPP");
    assert.equal(operationalCase.type, "SALES");
    const intent = await system.prisma.intent.findUniqueOrThrow({ where: { referenceCode: intentResponse.body.referenceCode } });
    assert.ok(intent.convertedAt);
    await assert.rejects(system.caseService.createManualWhatsappCase(input), (error) => error.code === "P2002");
    assert.equal(await system.prisma.case.count(), 1);
  } finally { await system.close(); }
});
