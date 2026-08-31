import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { applyMigrationChain } from "./support.js";

test("a fresh SQLite database reaches the lead and intent schema through the complete migration chain", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "solima-migration-"));
  const databasePath = path.join(root, "solima.db");
  try {
    const migrations = await applyMigrationChain(databasePath);
    assert.deepEqual(migrations, ["20260726170000_init", "20260819000000_lead_delivery_architecture", "20260831000000_intent_foundation"]);
    const database = new DatabaseSync(databasePath);
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((row) => row.name);
    database.close();
    assert.deepEqual(tables.filter((name) => !name.startsWith("_")), ["Intent", "LeadMedia", "LeadSubmission", "LeadSubmissionExtra", "WhatsAppDelivery"]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
