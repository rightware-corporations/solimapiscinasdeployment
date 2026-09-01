CREATE TABLE "Intent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "referenceCode" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceRef" TEXT,
  "sourceNameSnapshot" TEXT,
  "suggestedService" TEXT,
  "ctaType" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "convertedAt" DATETIME
);

CREATE UNIQUE INDEX "Intent_referenceCode_key" ON "Intent"("referenceCode");
CREATE INDEX "Intent_channel_createdAt_idx" ON "Intent"("channel", "createdAt");
CREATE INDEX "Intent_sourceType_sourceRef_idx" ON "Intent"("sourceType", "sourceRef");
CREATE INDEX "Intent_convertedAt_idx" ON "Intent"("convertedAt");
