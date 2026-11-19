# B0-R — SOLIMA reconciliation checkpoint

Date: 2026-11-19
Status: CODE CONSOLIDATED / SOURCE CI PASS / DOMAIN ADR REVIEW PENDING
Working branch: `reconcile/b0r-unified-baseline`
Repository: `rightware-corporations/solimapiscinasdeployment`

## Pinned sources

- Approved integration baseline: `integration/pre-production-hardened` @ `cf98227a413463577f595f733f7e217e93f8ccc2` (PR #2/#3 integrated)
- Implemented B1–B3: `refactor/v2-backend-foundation` @ `138c2a2351b28891e71a028765408c56b98a72af` (Draft PR #4)
- PostgreSQL/Office planning: `feat/postgres-office-support-foundation` @ `e2cc241b80d21084f35aa35fbe694e8e8c38893f` (design documents only)
- Historical default `main`: `b817c5f705b642800dd0963a44023609ca235d32` (unchanged)

## Provenance and integration policy

Baseline is the approved integration branch. From B1–B3, 47 new/changed file versions were copied by their exact Git blob SHA, excluding four frontend polish files. The 7 new PostgreSQL/Office architecture and security documents were incorporated, but not treated as already implemented. This reconciliation does not delete or overwrite the original branches.

The following four files are deliberately preserved **byte-identically** from the approved integration baseline:

- `apps/web/css/projects-v2.css`
- `apps/web/css/quote-v2.css`
- `scripts/projects-f5-qa.mjs`
- `scripts/quote-f10-qa.mjs`

B1–B3 preserved `Intent`, `Case`, `NotificationDelivery`, SMTP/fake adapter, background retry, legacy `WhatsAppDelivery`, public contract, image processing and tests. `scripts/frontend-f16-final-qa.mjs` was recovered from the backend branch. The existing QA workflow adds this reconciliation branch as a push target so a new run can verify the combined snapshot.

This is a **content integration**, not a conventional Git merge. Commit history of the two source branches is traceable through the pinned refs, while the reconciliation commit is based only on the approved integration branch. The original Draft PR #4 is NOT merged or closed by this action.

## Decisions / distinction

- Public form: `POST /api/leads` creates `LeadSubmission`, a `Case`, and an email `NotificationDelivery` in one transaction. SMTP is asynchronous after commit. New form submissions do not automatically create a Meta WhatsApp delivery.
- WhatsApp CTA: server-validated independent `Intent`, attribution reference and `wa.me` link; a click is not a verified conversation.
- Official media cap in the latest implementation prompt: at most 3 location photos, 2 inspiration photos, and 5 total. The newer conceptual PostgreSQL document separately requests at least one location photo; this minimum is NOT yet enforced by the B3 implementation and needs an explicit compatibility decision.
- `Case` from the implementation prompt is the operational record; PostgreSQL conceptual design introduces `Lead`, `Quote`, `Sale`, `Project`, `SupportCase`. A canonical state-ownership/relationship decision is REQUIRED before schema migration; these must not produce competing state machines.
- Definitive target database: PostgreSQL, single SOLIMA organization, initial Railway deployment and Linux/VPS portability. Existing Prisma remains SQLite; imported docs do not implement PostgreSQL.
- SOLIMA Office is NOT implemented in the active v2 app. The legacy admin source in `legacy/` is not a secure active Office backend.
- OpenWA is out of scope. Existing Meta paths are preserved but not the newly active form-notification flow.

## Known open technical risks

1. PostgreSQL cutover/backfill, historical production data and rollback/restore not verified.
2. `Case` lifecycle vs `Lead` lifecycle, `Sale` and specialized `SupportCase` semantics need canonical ownership.
3. No Admin identity/sessions/CSRF/object authorization/audit foundation yet.
4. Lead media is transport media; durable authenticated private Office attachments remain unimplemented.
5. Mandatory location photo minimum conflicts with current public contract; test browser and API together before enable.
6. Documents `docs/production-architecture.md` and `docs/go-live-runbook.md` describe legacy delivery and must be updated once the target release is specified.
7. Formal retention periods, fiscal defaults, admin trust boundary and production provider configuration require validation.
8. CI passing for source branches is not evidence of this combined branch passing. A green reconciliation run is mandatory.

## Acceptance gate B0-R

- [x] Remote heads/PRs and clean source provenance verified by GitHub read-only checks
- [x] Four frontend polish files protected from replacement
- [x] B1–B3 implementation and tests copied without deleting hardened legacy logic
- [x] Seven architecture/security docs incorporated with design-only status
- [x] QA workflow configured to exercise this branch on push
- [x] GitHub Actions full regression and visual QA PASS on source reconciliation HEAD `7c5198149e509cd2bcc837fbc0b51a3a361871e6` (push run `44492902998`, PR run `44493052660`, both 29-step jobs SUCCESS)
- [ ] Re-check API/form expectations with integration screenshots
- [x] Domain model options and proposed ownership recorded in `ADR-001-CANONICAL-CASE-COMMERCIAL-SUPPORT.md` (PROPOSED; not approved)
- [ ] Domain ADR-001 explicitly accepted or amended before PostgreSQL migrations
- [ ] Delivery configuration and staging data migration plan approved

**Gate status: CI PASS / DOMAIN REVIEW REQUIRED**. Tests passed on the code-reconciliation commit. ADR-001 remains a proposal, and further documentation commits require their own CI result. No deployment or migration authorized.
