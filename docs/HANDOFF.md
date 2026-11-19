# SOLIMA — active engineering handoff

Updated: 2026-11-19
Status: B0-R source reconciliation CI PASS; ADR-001 PROPOSED; no production release
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
- Current documentation-only commits have not been proven by a new CI result; code snapshot `7c5198149e509cd2bcc837fbc0b51a3a361871e6` passed push and PR full QA (runs `44492902998` and `44493052660`, both successful)

## Immutable inputs / references

- Base integration: `cf98227a413463577f595f733f7e217e93f8ccc2`
- B1–B3 source: `138c2a2351b28891e71a028765408c56b98a72af` / Draft PR #4
- PostgreSQL design source: `e2cc241b80d21084f35aa35fbe694e8e8c38893f`
- See `docs/architecture/B0R-RECONCILIATION-2026-11-19.md` for byte-level merge policy, risks and verification checklist.

## ADR-001 proposal (not approved)

The proposed canonical model is in `docs/architecture/ADR-001-CANONICAL-CASE-COMMERCIAL-SUPPORT.md`: Case owns operational and commercial workflow state; LeadSubmission remains immutable intake; Quote/QuoteVersion, Sale and Project are distinct; SupportCase is a project-bound specialty linked to a Case, with no parallel workflow status. Conflicts and open approvals are documented in ADR-001. No new migrations are authorized by this proposal.

## Mandatory next steps

1. Verify documentation-only commit CI; the prior code reconciliation has full green regression and visual evidence.
2. Review ADR-001 and finalize `Case` versus `Lead`/commercial ownership and media minimum compatibility; record an explicit ADR.
3. Perform database inventory + PostgreSQL schema/cutover design, including existing data/notification outbox continuity.
4. Implement private durable media and admin security without public exposure.
5. Implement SOLIMA Office workflows with Quote, Sale, Customer, Project, Support, authorization and audit.
6. Run migration, security, regression, visual and restore drills; release only after explicit production approval.

## Safety rules

No rewrite of the hardened backend, no automatic production deployment, no OpenWA activation, no schema-destructive operations, no change to `main`, and no assumption that design documents are running code. Preserve exact idempotency and the distinction between a provider event and an operational event. Do not print secret configuration values.
