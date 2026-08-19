PRAGMA foreign_keys=OFF;

DROP TABLE "OutboxEvent";
DROP TABLE "QuoteRequestStatusHistory";
DROP TABLE "QuoteRequestFile";
DROP TABLE "AdminSession";
DROP TABLE "QuoteRequest";

CREATE TABLE "LeadSubmission" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "phoneE164" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "serviceType" TEXT NOT NULL,
  "notes" TEXT,
  "consentAt" DATETIME NOT NULL,
  "privacyPolicyVersion" TEXT NOT NULL,
  "deliveryStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "LeadSubmission_idempotencyKey_key" ON "LeadSubmission"("idempotencyKey");
CREATE INDEX "LeadSubmission_createdAt_idx" ON "LeadSubmission"("createdAt");
CREATE INDEX "LeadSubmission_deliveryStatus_createdAt_idx" ON "LeadSubmission"("deliveryStatus", "createdAt");

CREATE TABLE "LeadSubmissionExtra" (
  "leadSubmissionId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  PRIMARY KEY ("leadSubmissionId", "code"),
  CONSTRAINT "LeadSubmissionExtra_leadSubmissionId_fkey" FOREIGN KEY ("leadSubmissionId") REFERENCES "LeadSubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "LeadMedia" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "leadSubmissionId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "metaMediaId" TEXT,
  "expiresAt" DATETIME,
  "localDeletedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "LeadMedia_leadSubmissionId_fkey" FOREIGN KEY ("leadSubmissionId") REFERENCES "LeadSubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LeadMedia_leadSubmissionId_category_position_key" ON "LeadMedia"("leadSubmissionId", "category", "position");
CREATE INDEX "LeadMedia_leadSubmissionId_idx" ON "LeadMedia"("leadSubmissionId");
CREATE INDEX "LeadMedia_status_expiresAt_idx" ON "LeadMedia"("status", "expiresAt");
CREATE INDEX "LeadMedia_sha256_idx" ON "LeadMedia"("sha256");

CREATE TABLE "WhatsAppDelivery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "leadSubmissionId" TEXT NOT NULL,
  "leadMediaId" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "destinationPhoneE164" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processingStartedAt" DATETIME,
  "metaMessageId" TEXT,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "acceptedAt" DATETIME,
  "sentAt" DATETIME,
  "deliveredAt" DATETIME,
  "readAt" DATETIME,
  "failedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "WhatsAppDelivery_leadSubmissionId_fkey" FOREIGN KEY ("leadSubmissionId") REFERENCES "LeadSubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WhatsAppDelivery_leadMediaId_fkey" FOREIGN KEY ("leadMediaId") REFERENCES "LeadMedia" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WhatsAppDelivery_leadMediaId_key" ON "WhatsAppDelivery"("leadMediaId");
CREATE UNIQUE INDEX "WhatsAppDelivery_dedupeKey_key" ON "WhatsAppDelivery"("dedupeKey");
CREATE UNIQUE INDEX "WhatsAppDelivery_leadSubmissionId_sequence_key" ON "WhatsAppDelivery"("leadSubmissionId", "sequence");
CREATE INDEX "WhatsAppDelivery_leadSubmissionId_idx" ON "WhatsAppDelivery"("leadSubmissionId");
CREATE INDEX "WhatsAppDelivery_status_nextAttemptAt_idx" ON "WhatsAppDelivery"("status", "nextAttemptAt");
CREATE INDEX "WhatsAppDelivery_metaMessageId_idx" ON "WhatsAppDelivery"("metaMessageId");

PRAGMA foreign_keys=ON;
