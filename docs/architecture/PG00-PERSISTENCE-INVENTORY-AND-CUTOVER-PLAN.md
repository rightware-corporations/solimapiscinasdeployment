# PG-00 — Persistence inventory, PostgreSQL cutover readiness and data-preservation plan

**Date:** 2026-11-19  
**Status:** CODE AUDIT COMPLETE / OFFLINE-INVENTORY TOOL READY / LIVE DATA UNKNOWN / CUTOVER BLOCKED  
**Repository:** `rightware-corporations/solimapiscinasdeployment`  
**Working branch:** `reconcile/b0r-unified-baseline`  
**B0-R reference:** `42807ae7c87276e75fe8d3130c3cd7d861902bb6` (ADR-001 proposed; two CI runs PASS)  
**Authority:** This is an engineering preparation document, **not** approval to migrate, inspect production secrets, or deploy.

## 1. Evidence and limits

Read from the active reconciliation branch:

- `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**`, `migration_lock.toml`.
- `apps/api/src/config/env.js`, `apps/api/src/server.js`, `apps/api/src/db/prisma.js`.
- `apps/api/src/leads/**`, `apps/api/src/cases/**`, `apps/api/src/notifications/**`, `apps/api/src/deliveries/**`, `apps/api/src/maintenance/cleanup.js`.
- `Dockerfile`, `railway.json`, `package.json`, `.env.example`, `docs/production-architecture.md`, `docs/go-live-runbook.md`.
- `docs/architecture/ADR-001-CANONICAL-CASE-COMMERCIAL-SUPPORT.md` (proposal only).
- GitHub Actions regression/visual results: B0-R reconciliation commit `7c5198149e509cd2bcc837fbc0b51a3a361871e6` passed full push and PR suites; ADR documentation commit `42807ae7c87276e75fe8d3130c3cd7d861902bb6` also passed full push and PR suites.

**Critical evidence limit:** The repository contains deploy configuration and older statements about an operational Railway/SQLite volume; it does **not** prove the current Railway deployment, production database contents, provider configuration or existence of a retrievable backup. No live Railway/SQLite data has been read. No customer/transaction data has been copied. A zero in the test database cannot be used to claim production has zero records.

## 2. Actual implemented persistence

Prisma v6.12.0; provider: **SQLite**; migration lock: `sqlite`; existing datastore and processed-media storage use filesystem paths.

Five SQLite migration scripts in sorted order:

| Migration | What it does | Preservation issue |
| --- | --- | --- |
| `20260726170000_init` | Creates `QuoteRequest`, files, status history, `OutboxEvent` and `AdminSession` | May contain pre-hardened business history in old deployments |
| `20260819000000_lead_delivery_architecture` | **Drops all five previous tables** and introduces `LeadSubmission`, extras, media, `WhatsAppDelivery` | Potential historical data destruction; cannot assume the old rows were migrated |
| `20260831000000_intent_foundation` | Adds `Intent` and reference uniqueness | Preserve all existing attribution references |
| `20260831010000_case_core` | Adds `Case` and unique one-to-one optional relations | Legacy leads may have no Case; backfill required if source data exists |
| `20260901000000_notification_delivery` | Adds `NotificationDelivery` and unique dedupe key | Existing Meta outbox is not equivalent to an email outbox |

Seven currently defined Prisma models: `Intent`, `LeadSubmission`, `Case`, `NotificationDelivery`, `LeadSubmissionExtra`, `LeadMedia`, `WhatsAppDelivery`.

### Current-state fact vs PostgreSQL target

| Component | Current code | PostgreSQL target | Gate |
| --- | --- | --- | --- |
| Prisma | SQLite schema and SQLite migrations | Separate, reviewable PostgreSQL migration history | ADR acceptance; staging proof |
| IDs | UUID-like string IDs from app | Preserve exactly in `uuid` where valid; audit invalid historical values first | Type-cast preflight |
| `LeadSubmission` | Immutable-ish original form plus mutable legacy `deliveryStatus` | Keep exact intake, fingerprint, consent and idempotency semantics | Replay/fingerprint concurrency |
| `Case` | Current work record with nullable plain-string `customerId`, `assignedUserId`, `createdByUserId` | Canonical state/relationships and future FK only after backfill/identity | ADR-001 |
| `Intent` | Server-resolved public attribution and `convertedAt` | Preserve refs and uniqueness; no inferred confirmed WhatsApp conversation | Data and attribution checks |
| `NotificationDelivery` | **Required** `leadSubmissionId` and `caseId`; status/attempts/provider ID | Preserve active B3 behavior initially; generalization to other channels must be additive | Durable outbox/replay |
| `WhatsAppDelivery` | Legacy durable Meta outbox | Preserve history and delivery state; no synthetic provider acceptance | Reconciliation before any runner |
| `LeadMedia` | Processed transport JPEG metadata and original-image raw hash | Private Office media lifecycle separately, retention explicit | Do not delete photos pending copy |
| Office business tables | Not implemented | Customer/Quote/QuoteVersion/SiteVisit/Sale/Project/Support/Identity/Audit | ADR-001 and auth design |

`LeadMedia.sha256` currently stores the **original upload** hash used for fingerprinting, not necessarily the checksum of the processed JPEG. Any media-integrity manifest needs a separately computed processed-file hash.

## 3. Important implementation blockers detected

### PG00-P0-A — Legacy WhatsApp runner starts while Meta delivery is disabled

`server.js` creates a `FakeWhatsAppAdapter` when `WHATSAPP_ENABLED=false`, but unconditionally executes `legacyRunner.startRecovery()`. An old `WhatsAppDelivery` in `PENDING` or `RETRY` can then be processed through fake delivery, marked `ACCEPTED`, and for images the local file can be deleted. This creates false operational evidence. Before production or historical cutover, implement a **fail-closed runtime gate** and a regression test with a pending legacy delivery and Meta disabled.

### PG00-P0-B — Legacy media cleanup can defeat email attachment retention

`DeliveryRunner.deleteAcceptedLocalMedia` deletes accepted WhatsApp image files; `maintenance/cleanup.js` deletes accepted/expired legacy image files without evaluating the state of B3 `NotificationDelivery` or a future private Office-media retention claim. B3 email attaches processed JPEGs by `LeadMedia.storageKey`. Therefore an unsent, retryable or manually recoverable email may lose its attachment. Do not run the current cleanup against shared legacy/B3 media until a retention claim and email/outbox safety guard exist. Preserve media for Office until the B4 authenticated private-archive policy is explicitly approved.

### PG00-P0-C — Historic destructive migration and no live dataset evidence

The `20260819000000` SQLite migration drops legacy `QuoteRequest`, `QuoteRequestFile`, `QuoteRequestStatusHistory`, `OutboxEvent`, `AdminSession`. The present test suite runs these migrations against **fresh empty databases**. It does not show that historical production rows survived. Check backups/snapshot histories before assuming there is nothing to recover. Never rerun this migration blindly on a dataset with old records.

### PG00-P1 — Production code is intentionally locked to SQLite

`loadConfig` requires in production exactly `DATABASE_URL=file:/app/data/solima.db` and `STORAGE_ROOT=/app/data/pending-media`. The Docker `CMD` touches a SQLite file before `prisma migrate deploy`; `migration_lock.toml` declares `sqlite`; existing tests use `node:sqlite`. Therefore a PostgreSQL URL cannot be enabled merely by changing an environment variable. A separately gated migration and startup/CI redesign is required.

### PG00-P1 — Existing runbooks are stale

`docs/production-architecture.md` and `docs/go-live-runbook.md` still describe Meta WhatsApp as the primary automatic FORM delivery path. B3 changed the intended path to email. These docs must not authorize production cutover. Replace them only when the new release runbook has tested restore/rollback evidence.

## 4. Read-only offline snapshot inventory

Script: `scripts/pg00-sqlite-inventory.mjs`  
Tests: `tests/pg00-sqlite-inventory.test.js`.

**Usage on an isolated, consistent SQLite backup copy, not the live volume:**

```sh
node scripts/pg00-sqlite-inventory.mjs /path/to/isolated-snapshot.db
```

The script uses `DatabaseSync(snapshot, {readOnly:true})` and `PRAGMA query_only=ON`. It produces JSON **aggregate counts only**, with no PII, raw rows, phone numbers, storage keys or credentials. It reports:

- Presence and counts of current/legacy tables and SQLite byte length.
- SQLite quick-check flag, number of foreign-key violations, count of Prisma migrations if present.
- Aggregate email/WhatsApp/media state counts.
- FORM submissions without matching Case; mismatched NotificationDelivery→Case linkage.
- Media marked deleted with unresolved email; unresolved historical Meta messages.

This script does **not** prove filesystem/media availability, provider acceptance, external exactly-once delivery, backup consistency, or recoverability. It does **not** generate a SQLite backup. Its input must be a properly captured copy, ideally using SQLite's supported consistent backup mechanism while its owning service is quiesced/isolated. Copying only the live `.db` while WAL is active may omit uncheckpointed transactions.

**Data handling:** keep the original database and media backups encrypted and access-controlled; do not upload them to GitHub, CI artifacts, public web services or this chat. Share only a reviewed, aggregate PG-00 JSON if needed.

## 5. Inventory result slots (not yet measured)

| Evidence | Status | Owner/action |
| --- | --- | --- |
| Current Railway service/project, active deployment SHA and replica count | UNKNOWN | Read-only infrastructure verification |
| Current SQLite volume path and snapshot timestamp | UNKNOWN | Verify without changing environment |
| Number of public leads and historic QuoteRequests | UNKNOWN | Offline PG00 inventory |
| Number of Cases missing for existing leads | UNKNOWN | Offline PG00 inventory |
| Number and states of Meta and email outbox deliveries | UNKNOWN | Offline PG00 inventory; provider reconciliation |
| Size and integrity of media backing files | UNKNOWN | Separate private media manifest, no deletion |
| Availability of pre-2026-08-19 backup | UNKNOWN | Critical historical preservation check |
| Backup restore test and recovery point | NOT VERIFIED | Staging restore drill |
| PostgreSQL target instance, version, backup policy | NOT PROVISIONED/NOT VERIFIED | After ADR and design acceptance |

Do not replace UNKNOWN with a guessed 0.

## 6. Safe migration architecture (proposal only)

**Phase 0 — Freeze evidence:** pin deploy SHA and schema history; obtain provider state and volume/backup inventory read-only; stop automated job actions on any isolated restore. Produce validated, encrypted, timestamped consistent DB + processed-media snapshots and a restore test. Identify any existing pre-hardening `QuoteRequest` backup; if found, preserve untouched and design separate historic records/archive, **not automatic Sale conversion**.

**Phase 1 — Canonical schema:** obtain explicit ADR-001 decisions, especially Case as workflow owner and Sale creation timing. Design PostgreSQL tables for seven existing models first, then additive Office domain tables, constraints, audit and private media. Avoid duplicating mutable Lead workflow or Support status. New PostgreSQL migrations must have PostgreSQL-compatible SQL; SQLite's PRAGMA and SQLite SQL are not portable. Preserve original SQLite history as evidence.

**Phase 2 — Test migration:** build a read-only/source-export and isolated target-import tool with restartability, integrity counts, deterministic mapping and clear key preservation. Use a separate `postgres` integration service in CI. No production network/provider calls. Keep pending outboxes paused and reconcile external state. Run dry-run on a scrubbed consistent snapshot, then on an authorized private staged copy.

**Phase 3 — Verify:** compare row counts, IDs, unique keys, hashes/fingerprints, non-null constraints, children, status distributions, timestamp/UTC precision and FK integrity. Check media key mapping and file existence privately. Backfill Case for historical FORM leads where absent, idempotently and with traceable provenance. Never synthesize a Customer, accepted QuoteVersion, Sale, Project or confirmed WhatsApp conversation from an old FORM.

**Phase 4 — Controlled switchover:** only with explicit release authorization. Freeze writes and provider runners; take final consistent backup; synchronize final delta; run verification; atomically switch exactly one writer to the verified PostgreSQL datastore; keep rollback path and provider outbox reconciliation plan. A code rollback alone does not reverse schema/data. Do not run SQLite and PostgreSQL as concurrent independent authoritative writers.

**Phase 5 — Observe:** health, retries, logs without PII, reconciliation reports, backup/restore and business smoke. Keep prior snapshot immutable until approved retention. Only later remove compatibility logic when verified.

## 7. Required gates and tests

**PG00-G0 (read-only inventory):**
- [x] Code/schema/5 SQLite migration scripts inventoried.
- [x] Unverified production data explicitly classified UNKNOWN.
- [x] Read-only inventory utility and four targeted tests added; local Node 22 tests passed before repository commit.
- [ ] GitHub Actions CI on final PG00 commit PASS.
- [ ] Live deployment/volume/backup ownership and read-only provenance established.
- [ ] Isolated snapshot counts and checksum/restore evidence provided.
- [ ] Historical pre-B2 leads and pre-2026-08-19 QuoteRequests reconciled.

**PG00-G1 (cutover design, must precede SQL):**
- [ ] ADR-001 accepted or amended.
- [ ] Runtime P0-A and media P0-B fixed and regression-tested.
- [ ] Target PostgreSQL compatibility schema and type/foreign-key matrix reviewed.
- [ ] Non-destructive outbox and media migration with restore drill defined.
- [ ] Database data/backup security and migration credentials reviewed.

**PG00-G2 (execution):** remains BLOCKED pending G0/G1, staging migration, concurrent idempotency testing and explicit operator approval.

## 8. Immediate engineering work in this chat

1. Ensure PG00 inventory tests pass on the reconciliation branch.
2. Fix **P0-A legacy fake delivery** with a gated startup and regression tests.
3. Fix **P0-B premature shared JPEG deletion** with a retention guard and tests; do not pre-empt B4's broader private archive design.
4. Obtain current infrastructure snapshot via authorized read-only provider connection, if available.
5. Explicitly resolve ADR-001 and write PostgreSQL logical mapping only after those gates.

**No production writes, migrations, deployments, provider sends or destructive file cleanup were performed for PG-00.**
