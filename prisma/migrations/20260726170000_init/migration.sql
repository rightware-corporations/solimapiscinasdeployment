PRAGMA foreign_keys=ON;
CREATE TABLE "QuoteRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ticketNumber" TEXT NOT NULL,
  "publicStatusToken" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "phoneE164" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "serviceType" TEXT NOT NULL,
  "extrasJson" TEXT NOT NULL DEFAULT '[]',
  "notes" TEXT,
  "consentGiven" BOOLEAN NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "notificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "whatsappCustomerMessageId" TEXT,
  "whatsappStaffMessageId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "QuoteRequest_ticketNumber_key" ON "QuoteRequest"("ticketNumber");
CREATE UNIQUE INDEX "QuoteRequest_publicStatusToken_key" ON "QuoteRequest"("publicStatusToken");
CREATE UNIQUE INDEX "QuoteRequest_idempotencyKey_key" ON "QuoteRequest"("idempotencyKey");
CREATE TABLE "QuoteRequestFile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "quoteRequestId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "originalNameSanitized" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "thumbnailStorageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuoteRequestFile_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest" ("id") ON DELETE CASCADE
);
CREATE INDEX "QuoteRequestFile_quoteRequestId_idx" ON "QuoteRequestFile"("quoteRequestId");
CREATE INDEX "QuoteRequestFile_sha256_idx" ON "QuoteRequestFile"("sha256");
CREATE TABLE "QuoteRequestStatusHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "quoteRequestId" TEXT NOT NULL,
  "previousStatus" TEXT,
  "newStatus" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuoteRequestStatusHistory_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest" ("id") ON DELETE CASCADE
);
CREATE INDEX "QuoteRequestStatusHistory_quoteRequestId_idx" ON "QuoteRequestStatusHistory"("quoteRequestId");
CREATE TABLE "OutboxEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "quoteRequestId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" DATETIME,
  CONSTRAINT "OutboxEvent_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest" ("id") ON DELETE CASCADE
);
CREATE INDEX "OutboxEvent_status_nextAttemptAt_idx" ON "OutboxEvent"("status", "nextAttemptAt");
CREATE TABLE "AdminSession" ("id" TEXT NOT NULL PRIMARY KEY, "data" TEXT NOT NULL, "expiresAt" DATETIME NOT NULL);
