import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { inspectSqliteSnapshot } from "../scripts/pg00-sqlite-inventory.mjs";

function fixture(sql) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "solima-pg00-"));
  const filename = path.join(folder, "snapshot.sqlite");
  const db = new DatabaseSync(filename);
  db.exec(sql);
  db.close();
  return { filename, remove: () => fs.rmSync(folder, { recursive: true, force: true }) };
}

test("PG00 refuses a missing snapshot without creating a database", () => {
  const filename = path.join(os.tmpdir(), "nonexistent-solima-pg00-" + process.pid + ".db");
  assert.throws(() => inspectSqliteSnapshot(filename));
  assert.equal(fs.existsSync(filename), false);
});

test("PG00 observes old QuoteRequest/OutboxEvent rows without exposing client values", () => {
  const f = fixture(`CREATE TABLE "QuoteRequest" (id TEXT, customerName TEXT);
    INSERT INTO "QuoteRequest" VALUES ('legacy-1', 'SENSITIVE_SAMPLE_CLIENT');
    CREATE TABLE "OutboxEvent" (id TEXT); INSERT INTO "OutboxEvent" VALUES ('event-1');`);
  try {
    const result = inspectSqliteSnapshot(f.filename);
    assert.equal(result.tables.QuoteRequest, 1);
    assert.equal(result.tables.OutboxEvent, 1);
    assert.equal(result.tables.LeadSubmission, null);
    assert.equal(result.integrityQuickCheckPassed, true);
    assert.equal(result.foreignKeyViolations, 0);
    assert.doesNotMatch(JSON.stringify(result), /SENSITIVE_SAMPLE_CLIENT|legacy-1|event-1|snapshot\.sqlite/);
  } finally { f.remove(); }
});

test("PG00 summarizes current B3 data, missing Cases, stale Email media and unresolved Meta deliveries", () => {
  const f = fixture(`CREATE TABLE "LeadSubmission" (id TEXT PRIMARY KEY);
    CREATE TABLE "Case" (id TEXT, sourceLeadSubmissionId TEXT);
    CREATE TABLE "NotificationDelivery" (id TEXT, caseId TEXT, leadSubmissionId TEXT, status TEXT);
    CREATE TABLE "LeadMedia" (id TEXT, leadSubmissionId TEXT, localDeletedAt TEXT, status TEXT);
    CREATE TABLE "WhatsAppDelivery" (id TEXT, status TEXT);
    INSERT INTO "LeadSubmission" VALUES ('l1'), ('l2');
    INSERT INTO "Case" VALUES ('c1', 'l1');
    INSERT INTO "NotificationDelivery" VALUES ('n1', 'c1', 'l1', 'RETRY');
    INSERT INTO "LeadMedia" VALUES ('m1', 'l1', '2026-01-01', 'DELETED');
    INSERT INTO "WhatsAppDelivery" VALUES ('w1','PENDING');`);
  try {
    const result = inspectSqliteSnapshot(f.filename);
    assert.equal(result.consistency.submissionsWithoutCase, 1);
    assert.equal(result.consistency.notificationCaseMismatch, 0);
    assert.equal(result.consistency.deletedMediaWithUnresolvedEmail, 1);
    assert.equal(result.consistency.legacyWhatsappUnresolved, 1);
    assert.equal(result.statusCounts.NotificationDelivery.RETRY, 1);
    assert.equal(result.statusCounts.WhatsAppDelivery.PENDING, 1);
  } finally { f.remove(); }
});

test("PG00 opens an isolated snapshot without mutating its bytes", () => {
  const f = fixture('CREATE TABLE "LeadSubmission" (id TEXT PRIMARY KEY);');
  try {
    const before = fs.readFileSync(f.filename);
    const result = inspectSqliteSnapshot(f.filename);
    const after = fs.readFileSync(f.filename);
    assert.equal(result.tables.LeadSubmission, 0);
    assert.deepEqual(after, before);
  } finally { f.remove(); }
});
