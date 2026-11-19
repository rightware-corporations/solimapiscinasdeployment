# SOLIMA — active engineering handoff

Updated: 2026-11-19
Status: PG-00 code audited, offline inventory added, runtime/media P0 patches staged; CI pending; no production release
Repository: `rightware-corporations/solimapiscinasdeployment`
Active branch: `reconcile/b0r-unified-baseline`

## What is implemented in this branch

- Approved landing v2, including desktop projects/quote polish from PR #3, plus F16 acceptance script
- Secure public lead intake, idempotency, image sanitization and existing legacy Meta support
- B1: independent WhatsApp Intent attribution and server-side redirect generation
- B2: Case operational core and idempotent FORM→Case link; manual WhatsApp Case domain service
- B3: NotificationDelivery email outbox, retry/recovery, processed JPEG attachments and test coverage
- Architecture documents from `feat/postgres-office-support-foundation` retained as **design**, not database migrations
- PG-00: read-only SQLite snapshot inventory (`scripts/pg00-sqlite-inventory.mjs`), 4 targeted tests; local Node 22 test run PASS
- PG-00 safety changes: provider-aware recovery startup (no disabled-provider fake delivery), media retention guard for legacy Meta and B3 email references, with regression tests. Their final GitHub CI is pending.

## What is not implemented or confirmed

- PostgreSQL schema migration/cutover (Prisma provider still sqlite)
- Authenticated Admin / SOLIMA Office, private media access, commercial Quote/Sale/Project system and Support UI
- End-to-end staging/production operation, current data backup/restore or final release gates
- No full GitHub CI PASS is yet claimed for the latest PG-00 code commit `54f9fe9340d09326f86a89fb45e5ac5b6ed90186`; previous B0-R / ADR-001 runs passed
- Actual Railway service, production database contents, pre-hardening backups and provider state UNKNOWN, not assumed empty

## Immutable inputs / references

- Base integration: `cf98227a413463577f595f733f7e217e93f8ccc2`
- B1–B3 source: `138c2a2351b28891e71a028765408c56b98a72af` / Draft PR #4
- PostgreSQL design source: `e2cc241b80d21084f35aa35fbe694e8e8c38893f`
- See `docs/architecture/B0R-RECONCILIATION-2026-11-19.md` for byte-level merge policy, risks and verification checklist.

## ADR-001 proposal (not approved)

The proposed canonical model is in `docs/architecture/ADR-001-CANONICAL-CASE-COMMERCIAL-SUPPORT.md`: Case owns operational and commercial workflow state; LeadSubmission remains immutable intake; Quote/QuoteVersion, Sale and Project are distinct; SupportCase is a project-bound specialty linked to a Case, with no parallel workflow status. Conflicts and open approvals are documented in ADR-001. No new migrations are authorized by this proposal.

## Mandatory next steps

1. Verify full GitHub Actions and new regression tests on PG-00 safety commit and close only proven failures.
2. Establish authorized, read-only Railway service/volume provenance and obtain an isolated, consistent backup; execute PG00 offline aggregate inventory only on that copy.
3. Review/approve or amend ADR-001 and image contract; no independent duplicate mutable Lead state.
4. Design PostgreSQL schema + migration/backfill, including legacy QuoteRequest, historical Case gaps, pending provider outboxes and retained media.
5. Implement private durable media and admin security without public exposure.
6. Implement SOLIMA Office workflows with Quote, Sale, Customer, Project, Support, authorization and audit.
7. Run migration, security, regression, visual and restore drills; release only after explicit production approval.

## PG-00 operational evidence

- See `docs/architecture/PG00-PERSISTENCE-INVENTORY-AND-CUTOVER-PLAN.md` for exact current schema/migration history and historical data-loss hazards.
- The 2026-08-19 SQLite migration drops old QuoteRequest/OutboxEvent tables; production data and backups have NOT been inspected.
- Active production config is SQLite-only; the Dockerfile and Prisma lock cannot accept PostgreSQL by a simple variable change.
- Runtime/media P0 patches have been implemented in this branch but are NOT deployed.

## Safety rules

No rewrite of the hardened backend, no automatic production deployment, no OpenWA activation, no schema-destructive operations, no change to `main`, and no assumption that design documents are running code. Preserve exact idempotency and the distinction between a provider event and an operational event. Do not print secret configuration values.
