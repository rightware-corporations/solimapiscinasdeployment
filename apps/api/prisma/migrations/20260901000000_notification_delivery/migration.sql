CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "leadSubmissionId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processingStartedAt" DATETIME,
  "providerMessageId" TEXT,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "sentAt" DATETIME,
  "failedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "NotificationDelivery_leadSubmissionId_fkey" FOREIGN KEY ("leadSubmissionId") REFERENCES "LeadSubmission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "NotificationDelivery_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NotificationDelivery_dedupeKey_key" ON "NotificationDelivery"("dedupeKey");
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");
CREATE INDEX "NotificationDelivery_leadSubmissionId_idx" ON "NotificationDelivery"("leadSubmissionId");
CREATE INDEX "NotificationDelivery_caseId_idx" ON "NotificationDelivery"("caseId");
CREATE INDEX "NotificationDelivery_providerMessageId_idx" ON "NotificationDelivery"("providerMessageId");
