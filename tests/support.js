import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { loadConfig } from "../apps/api/src/config/env.js";
import { createPrisma } from "../apps/api/src/db/prisma.js";
import { createLogger } from "../apps/api/src/lib/logger.js";
import { LeadRepository } from "../apps/api/src/leads/repository.js";
import { LeadService } from "../apps/api/src/leads/service.js";
import { DeliveryRunner } from "../apps/api/src/deliveries/runner.js";
import { FakeWhatsAppAdapter } from "../apps/api/src/whatsapp/adapter.js";
import { createApp } from "../apps/api/src/app.js";

const migrationRoot = path.resolve("apps/api/prisma/migrations");

export async function applyMigrationChain(databasePath) {
  const database = new DatabaseSync(databasePath);
  const migrations = (await fs.readdir(migrationRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const migration of migrations) {
    database.exec(await fs.readFile(path.join(migrationRoot, migration, "migration.sql"), "utf8"));
  }
  database.close();
  return migrations;
}

export async function createTestSystem({ adapter = new FakeWhatsAppAdapter() } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "solima-test-"));
  const databasePath = path.join(root, "solima.db");
  await applyMigrationChain(databasePath);
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: `file:${databasePath.replaceAll("\\", "/")}`,
    STORAGE_ROOT: path.join(root, "pending-media"),
    WHATSAPP_DESTINATION_NUMBER: "258000000000",
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: "test-webhook-token-1234",
    META_APP_SECRET: "test-meta-app-secret-1234",
    PRIVACY_POLICY_VERSION: "test-v1",
    LOG_LEVEL: "error"
  });
  await fs.mkdir(config.storageRoot, { recursive: true });
  await fs.mkdir(config.rawUploadRoot, { recursive: true });
  const prisma = createPrisma(config);
  await prisma.$connect();
  const logger = createLogger({ level: "error", sink: { log() {}, info() {}, warn() {}, error() {} } });
  const repository = new LeadRepository(prisma);
  const runner = new DeliveryRunner({ repository, adapter, config, logger });
  const leadService = new LeadService({ repository, config, deliveryRunner: runner, logger });
  const app = createApp({ config, prisma, leadService, repository, logger });
  return {
    app, adapter, config, prisma, repository, runner,
    async close() {
      await runner.stop();
      await prisma.$disconnect();
      await fs.rm(root, { recursive: true, force: true });
    }
  };
}

export const validLead = () => ({
  customerName: "Ana Manjate",
  phone: "824407120",
  location: "Maputo, Sommerschield",
  serviceType: "NEW_CONSTRUCTION",
  extras: JSON.stringify(["LED", "DECK"]),
  notes: "Piscina residencial.",
  consentGiven: "true",
  startedAt: String(Date.now() - 5_000),
  website: ""
});
