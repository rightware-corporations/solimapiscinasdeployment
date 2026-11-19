CREATE TABLE "Case" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicReference" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "customerId" TEXT,
  "customerNameSnapshot" TEXT NOT NULL,
  "phoneE164" TEXT NOT NULL,
  "location" TEXT,
  "serviceType" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "workflowState" TEXT NOT NULL DEFAULT 'NEW',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "assignedUserId" TEXT,
  "createdByUserId" TEXT,
  "sourceIntentId" TEXT,
  "sourceLeadSubmissionId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "closedAt" DATETIME,
  "archivedAt" DATETIME,
  CONSTRAINT "Case_sourceIntentId_fkey" FOREIGN KEY ("sourceIntentId") REFERENCES "Intent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Case_sourceLeadSubmissionId_fkey" FOREIGN KEY ("sourceLeadSubmissionId") REFERENCES "LeadSubmission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Case_publicReference_key" ON "Case"("publicReference");
CREATE UNIQUE INDEX "Case_sourceLeadSubmissionId_key" ON "Case"("sourceLeadSubmissionId");
CREATE UNIQUE INDEX "Case_sourceIntentId_key" ON "Case"("sourceIntentId");
CREATE INDEX "Case_type_workflowState_createdAt_idx" ON "Case"("type", "workflowState", "createdAt");
CREATE INDEX "Case_channel_createdAt_idx" ON "Case"("channel", "createdAt");
CREATE INDEX "Case_phoneE164_idx" ON "Case"("phoneE164");
