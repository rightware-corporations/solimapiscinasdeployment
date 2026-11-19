# SOLIMA — active engineering handoff

Updated: 2026-11-19
Status: B0-R reconciliation (CI pending; no production release)
Repository: `rightware-corporations/solimapiscinasdeployment`
Active branch: `reconcile/b0r-unified-baseline`

## What is implemented in this branch

- Approved landing v2, including desktop projects/quote polish from PR #3, plus F16 acceptance script
- Secure public lead intake, idempotency, image sanitization and existing legacy Meta support
- B1: independent WhatsApp Intent attribution and server-side redirect generation
- B2: Case operational core and idempotent FORM→Case link; manual WhatsApp Case domain service
- B3: NotificationDelivery email outbox, retry/recovery, processed JPEG attachments and test coverage
- Architecture documents from `feat/postgres-office-support-foundation` retained as **design**, not database migrations

## What is not implemented or confirmed

- PostgreSQL schema migration/cutover (Prisma provider still sqlite)
- Authenticated Admin / SOLIMA Office, private media access, commercial Quote/Sale/Project system and Support UI
- End-to-end staging/production operation, current data backup/restore or final release gates
- Combined branch CI status until a new workflow run completes

## Immutable inputs / references

- Base integration: `cf98227a413463577f595f733f7e217e93f8ccc2`
- B1–B3 source: `138c2a2351b28891e71a028765408c56b98a72af` / Draft PR #4
- PostgreSQL design source: `e2cc241b80d21084f35aa35fbe694e8e8c38893f`
- See `docs/architecture/B0R-RECONCILIATION-2026-11-19.md` for byte-level merge policy, risks and verification checklist.

## Mandatory next steps

1. Inspect GitHub Actions on the current HEAD and fix only demonstrated integration regressions.
2. Finalize `Case` versus `Lead`/commercial ownership and media minimum compatibility; record an explicit ADR.
3. Perform database inventory + PostgreSQL schema/cutover design, including existing data/notification outbox continuity.
4. Implement private durable media and admin security without public exposure.
5. Implement SOLIMA Office workflows with Quote, Sale, Customer, Project, Support, authorization and audit.
6. Run migration, security, regression, visual and restore drills; release only after explicit production approval.

## Safety rules

No rewrite of the hardened backend, no automatic production deployment, no OpenWA activation, no schema-destructive operations, no change to `main`, and no assumption that design documents are running code. Preserve exact idempotency and the distinction between a provider event and an operational event. Do not print secret configuration values.
