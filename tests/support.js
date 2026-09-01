import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { loadConfig } from "../apps/api/src/config/env.js";
import { createPrisma } from "../apps/api/src/db/prisma.js";
import { createLogger } from "../apps/api/src/lib/logger.js";
import { LeadRepository } from "../apps/api/src/leads/repository.js";
import { LeadService } from "../apps/api/src/leads/service.js";
import { IntentRepository } from "../apps/api/src/intents/repository.js";
import { IntentService } from "../apps/api/src/intents/service.js";
import { CaseRepository } from "../apps/api/src/cases/repository.js";
import { CaseService } from "../apps/api/src/cases/service.js";
import { DeliveryRunner } from "../apps/api/src/deliveries/runner.js";
import { FakeWhatsAppAdapter } from "../apps/api/src/whatsapp/adapter.js";
import { NotificationRepository } from "../apps/api/src/notifications/repository.js";
import { NotificationRunner } from "../apps/api/src/notifications/runner.js";
import { FakeEmailAdapter } from "../apps/api/src/email/adapter.js";
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

export async function createTestSystem({ emailAdapter = new FakeEmailAdapter(), whatsappAdapter = new FakeWhatsAppAdapter() } = {}) {
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
    EMAIL_ENABLED: "true",
    EMAIL_PROVIDER: "fake",
    EMAIL_FROM: "notifications@solima.test",
    EMAIL_TO: "office@solima.test",
    LOG_LEVEL: "error"
  });
  await fs.mkdir(config.storageRoot, { recursive: true });
  await fs.mkdir(config.rawUploadRoot, { recursive: true });
  const prisma = createPrisma(config);
  await prisma.$connect();
  const logger = createLogger({ level: "error", sink: { log() {}, info() {}, warn() {}, error() {} } });
  const repository = new LeadRepository(prisma);
  const legacyRunner = new DeliveryRunner({ repository, adapter: whatsappAdapter, config, logger });
  const notificationRepository = new NotificationRepository(prisma);
  const runner = new NotificationRunner({ repository: notificationRepository, adapter: emailAdapter, config, logger });
  const leadService = new LeadService({ repository, config, deliveryRunner: runner, logger });
  const intentService = new IntentService({ repository: new IntentRepository(prisma), config, logger });
  const caseService = new CaseService({ repository: new CaseRepository(prisma) });
  const app = createApp({ config, prisma, leadService, intentService, repository, logger });
  return {
    app, adapter: emailAdapter, whatsappAdapter, caseService, config, prisma, repository, notificationRepository, runner, legacyRunner,
    async close() {
      await Promise.all([runner.stop(), legacyRunner.stop()]);
      await prisma.$disconnect();
      await fs.rm(root, { recursive: true, force: true });
    }
  };
}

export async function seedLegacyWhatsAppSummary(system) {
  const leadId = crypto.randomUUID();
  const caseId = crypto.randomUUID();
  const deliveryId = crypto.randomUUID();
  await system.repository.createGraph({
    lead: {
      id: leadId, idempotencyKey: crypto.randomUUID(), requestFingerprint: crypto.randomUUID(),
      customerName: "Legacy Test", phoneE164: "+258824407120", location: "Maputo",
      serviceType: "NEW_CONSTRUCTION", notes: null, consentAt: new Date(),
      privacyPolicyVersion: "legacy-test", extras: []
    },
    media: [],
    deliveries: [{
      id: deliveryId, leadSubmissionId: leadId, dedupeKey: `${leadId}:summary`, sequence: 0,
      kind: "SUMMARY", destinationPhoneE164: "258000000000"
    }],
    caseRecord: {
      id: caseId, publicReference: `SOL-C-LEGACY-${crypto.randomUUID()}`, type: "SALES", channel: "FORM",
      customerNameSnapshot: "Legacy Test", phoneE164: "+258824407120", location: "Maputo",
      serviceType: "NEW_CONSTRUCTION", title: "Legacy test", workflowState: "NEW", priority: "NORMAL",
      sourceLeadSubmissionId: leadId
    }
  });
  return system.prisma.whatsAppDelivery.findUniqueOrThrow({ where: { id: deliveryId } });
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
