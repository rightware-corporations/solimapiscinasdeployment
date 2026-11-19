import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const businessTables = [
  "LeadSubmission", "LeadSubmissionExtra", "LeadMedia", "Intent", "Case",
  "NotificationDelivery", "WhatsAppDelivery", "QuoteRequest", "QuoteRequestFile",
  "QuoteRequestStatusHistory", "OutboxEvent", "AdminSession"
];
const pendingStatuses = ["PENDING", "PROCESSING", "RETRY", "FAILED"];
const whitelistedStatuses = new Set([
  "RECEIVED", "PENDING", "PROCESSING", "RETRY", "FAILED", "SENT", "ACCEPTED",
  "DELIVERED", "READ", "DELIVERING", "PARTIAL", "READY", "DELETED"
]);

function count(db, query) {
  return Number(db.prepare(query).get()?.total ?? 0);
}

function countStatuses(db, table) {
  const rows = db.prepare('SELECT "status" AS state, COUNT(*) AS total FROM "' + table + '" GROUP BY "status"').all();
  const result = {};
  for (const row of rows) {
    const state = whitelistedStatuses.has(row.state) ? row.state : "OTHER";
    result[state] = (result[state] || 0) + Number(row.total);
  }
  return result;
}

export function inspectSqliteSnapshot(snapshotPath) {
  if (typeof snapshotPath !== "string" || !snapshotPath.trim()) throw new Error("Snapshot path is required");
  const stat = fs.statSync(snapshotPath);
  if (!stat.isFile()) throw new Error("Snapshot must be an existing regular file");
  const db = new DatabaseSync(snapshotPath, { readOnly: true });
  try {
    db.exec("PRAGMA query_only = ON");
    const present = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
    const counts = Object.fromEntries(businessTables.map((name) => [name, present.has(name) ? count(db, 'SELECT COUNT(*) AS total FROM "' + name + '"') : null]));
    const summary = {
      formatVersion: "SOLIMA-PG00-1",
      source: "offline-read-only-sqlite-snapshot",
      fileBytes: stat.size,
      integrityQuickCheckPassed: db.prepare("PRAGMA quick_check(1)").all().every((row) => Object.values(row).every((value) => value === "ok")),
      foreignKeyViolations: db.prepare("PRAGMA foreign_key_check").all().length,
      tables: counts,
      legacyTablesPresent: businessTables.slice(7).filter((name) => present.has(name)),
      prismaMigrationCount: present.has("_prisma_migrations") ? count(db, 'SELECT COUNT(*) AS total FROM "_prisma_migrations"') : null,
      statusCounts: {},
      consistency: {},
      caveats: ["Counts only; no customer records or storage keys exported", "External file/backup integrity and provider reconciliation are NOT verified"]
    };
    for (const table of ["NotificationDelivery", "WhatsAppDelivery", "LeadMedia"]) {
      if (present.has(table)) summary.statusCounts[table] = countStatuses(db, table);
    }
    if (present.has("LeadSubmission") && present.has("Case")) {
      summary.consistency.submissionsWithoutCase = count(db,
        'SELECT COUNT(*) AS total FROM "LeadSubmission" l WHERE NOT EXISTS (SELECT 1 FROM "Case" c WHERE c."sourceLeadSubmissionId" = l."id")');
      summary.consistency.casesWithMissingSubmission = count(db,
        'SELECT COUNT(*) AS total FROM "Case" c WHERE c."sourceLeadSubmissionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "LeadSubmission" l WHERE l."id" = c."sourceLeadSubmissionId")');
    }
    if (present.has("NotificationDelivery") && present.has("Case")) {
      summary.consistency.notificationCaseMismatch = count(db,
        'SELECT COUNT(*) AS total FROM "NotificationDelivery" n JOIN "Case" c ON c."id" = n."caseId" WHERE c."sourceLeadSubmissionId" IS NULL OR c."sourceLeadSubmissionId" <> n."leadSubmissionId"');
    }
    if (present.has("NotificationDelivery") && present.has("LeadMedia")) {
      summary.consistency.deletedMediaWithUnresolvedEmail = count(db,
        'SELECT COUNT(DISTINCT m."id") AS total FROM "LeadMedia" m JOIN "NotificationDelivery" n ON n."leadSubmissionId" = m."leadSubmissionId" WHERE m."localDeletedAt" IS NOT NULL AND n."status" IN (' + pendingStatuses.map((s) => "'" + s + "'").join(",") + ')');
    }
    if (present.has("WhatsAppDelivery")) {
      summary.consistency.legacyWhatsappUnresolved = count(db,
        'SELECT COUNT(*) AS total FROM "WhatsAppDelivery" WHERE "status" IN (\'PENDING\',\'PROCESSING\',\'RETRY\')');
    }
    return summary;
  } finally {
    db.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) {
    console.error("Usage: node scripts/pg00-sqlite-inventory.mjs /path/to/isolated-snapshot.db");
    process.exitCode = 2;
  } else {
    try {
      console.log(JSON.stringify(inspectSqliteSnapshot(process.argv[2]), null, 2));
    } catch (error) {
      console.error("PG00 inventory failed: " + (error?.code || error?.name || "Error"));
      process.exitCode = 1;
    }
  }
}
