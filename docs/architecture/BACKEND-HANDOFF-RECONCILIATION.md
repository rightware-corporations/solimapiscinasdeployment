# SOLIMA Backend — Handoff Reconciliation

Status: authoritative reconciliation  
Source reviewed: `SOLIMA-BACKEND-AUDIT-IMPLEMENTATION-HANDOFF.md` dated 2026-08-24  
Target branch: `feat/postgres-office-support-foundation`

## 1. Purpose

The reviewed handoff is a high-quality pre-implementation audit. It preserves important hardened invariants, but it predates later explicit product and architecture decisions. This document resolves conflicts so implementation follows one coherent source of truth.

Priority order:

1. latest explicit SOLIMA decisions
2. approved conceptual domain model
3. verified current repository behavior
4. useful recommendations from the handoff
5. older planning assumptions

## 2. Handoff findings accepted without change

The implementation must preserve:

- evolve the current backend rather than rewrite it
- durable database commit before provider calls
- strong idempotency and concurrent duplicate handling
- staged-media cleanup on transaction failure
- ordered original-image hashes in the business fingerprint
- chosen `serviceType` remains authoritative
- intent attribution never overrides customer choice
- hardened file-signature, pixel, size, decode, re-encode and metadata-removal pipeline
- durable ordered message outbox
- exact raw webhook bytes before Meta HMAC verification
- provider-independent health checks
- backward compatibility for cached public clients
- Admin security policy separate from the public-site CSP
- deny-by-default authorization
- task-specific mutations rather than unrestricted generic PATCH
- object-level authorization and IDOR tests
- append-only status history and audit
- separate commercial, project, support and provider-delivery states
- no direct exposure of filesystem storage keys
- no claim of external exactly-once delivery
- additive, gated release strategy
- separate feature activation from schema expansion
- no premature Redis, Kafka, Kubernetes or microservices
- no public Admin registration
- no provider network call inside business transactions

## 3. LeadIntent guidance accepted

The first public-contract addition remains an optional, strictly validated `intentContext`.

Accepted rules:

- optional for backward compatibility
- bounded serialized size
- allowlisted source types and fields
- excluded from the business fingerprint
- first attribution remains immutable on idempotent replay
- suggested service is context only
- generic cached clients continue to submit without it
- LeadIntent is created in the same durable lead transaction
- analytics failures must never block lead success

The exact logical model will be aligned with PostgreSQL and the approved DER.

## 4. Decisions that supersede the handoff

### Database

Handoff assumption:

- keep SQLite
- one replica
- PostgreSQL not in the backend wave

Official decision:

- PostgreSQL now
- Railway initially
- portable to VPS or physical Linux servers
- SQLite migration guidance is historical, not target architecture

Consequences:

- create a PostgreSQL migration/cutover plan
- preserve existing production data if any
- use PostgreSQL concurrency and constraints
- separate business database from media storage
- do not carry SQLite-only assumptions into new repositories or tests

### Scope

Handoff assumption:

- Support deferred
- backend complete before Support

Official decision:

- system complete includes Support
- Support is part of this product wave
- support intake is Admin-only initially
- every SupportCase must reference an existing Project
- no public support endpoint in the first release

Support remains sequenced after identity, customer, commercial and project foundations, but it is not out of scope.

### Customer model

Handoff focuses on LeadSubmission without a Customer master record.

Official model:

- public submission creates Lead only
- Lead preserves immutable contact snapshot
- approval resolves or creates Customer by normalized phone
- one active telephone per Customer
- approved Lead creates Project transactionally
- one Project per source Lead

### Commercial lifecycle

Handoff proposes:

- NEW, CONTACTED, QUALIFIED, SITE_VISIT, PROPOSAL, WON, LOST, ARCHIVED

Current conceptual work uses an approval-driven conversion where `APPROVED` creates Project. Exact lead lifecycle remains to be approved and must use the latest decision; `WON` must not coexist ambiguously with `APPROVED`.

### Project lifecycle

Officially approved compact lifecycle:

- PLANNED
- IN_PROGRESS
- PAUSED
- COMPLETED
- CANCELLED
- ARCHIVED

### Support categories

Officially approved as database-managed, extensible records:

- Maintenance
- Warranty
- Technical Issue
- Complaint
- Administrative Question
- Other

Used categories are deactivated rather than deleted.

### Support priority

Officially approved:

- manually selected by administrator
- three levels
- exact names pending

## 5. Recommendations requiring explicit approval

The handoff recommends a significantly stronger Admin trust path:

- dedicated Admin hostname
- zero-trust gateway
- signed gateway assertion
- passkey/WebAuthn
- server-side session
- CSRF
- permissions
- object authorization
- audit

This is architecturally sound but depends on unresolved operational decisions:

- Admin hostname
- gateway provider
- WebAuthn RP ID
- direct Railway-origin restriction
- recovery procedure
- session durations
- step-up policy

No allow-all gateway or production fake verifier may be shipped.

The initial single administrator does not justify removing security boundaries, but authentication method must be explicitly selected before implementation.

## 6. Media distinction accepted

Current LeadMedia is transport media and may be deleted after provider acceptance. It cannot silently become a permanent Office archive.

Required separation:

- transport media lifecycle
- private business attachment lifecycle
- explicit purpose and retention
- authenticated access
- audited download
- backup classification

Support and Project attachments require the private attachment model. Lead media archival remains a separate policy decision.

## 7. Provider architecture

Keep Meta integration and existing columns during migration.

Later additive provider evolution may introduce:

- provider discriminator
- provider-neutral external message ID
- uncertain-delivery/reconciliation state
- Meta adapter
- optional OpenWA adapter

The public WhatsApp number is not assumed to be the automated sender or operational destination.

## 8. Revised implementation order

### B0 — verified baseline

Completed structurally:

- correct base: `integration/pre-production-hardened`
- base commit: `f6634913ab9b1d3614d67f5002aa81c689528eaf`
- branch: `feat/postgres-office-support-foundation`

Repository QA baseline was green through frontend run #199 and merged deployment.

### B1 — conceptual model approval

In progress:

- customer creation rules
- lead-to-project conversion
- compact project lifecycle
- Admin-only project-bound support
- categories
- priorities
- support state and SLA policy

### B2 — PostgreSQL logical model and cutover design

- inventory SQLite migrations and production data
- design PostgreSQL schema
- prepare migration/copy verification
- retain hardened lead/outbox behavior
- create production-like migration tests

### B3 — backward-compatible LeadIntent

- optional API bridge
- strict validation
- immutable first attribution
- transaction integration
- compatibility tests

### B4 — identity and Admin security

- one initial owner
- no public registration
- selected authentication method
- secure server-side sessions
- CSRF, Origin, host and gateway controls as approved
- audit and security events
- last-owner protection

### B5 — customer and commercial pipeline

- immutable Lead snapshots
- Customer creation on approval
- Customer unique normalized phone
- approved Lead creates Project transactionally
- histories, notes and audit

### B6 — SOLIMA Office APIs

- bounded lead list/detail
- customer and project views
- task-specific state mutations
- safe media metadata
- secure attachment access when policy permits

### B7 — Support

- configurable categories
- three-level manual priority
- project-required SupportCase
- protocol
- status history
- messages/notes
- attachment policy
- Admin inbox

### B8 — operations and release

- PostgreSQL Railway staging
- backups and restore drill
- observability and alerts
- migration verification
- backend and frontend regression
- controlled feature activation

## 9. Branch-name reconciliation

The handoff recommended `backend/core-office-foundation`.

The already-created branch is:

`feat/postgres-office-support-foundation`

It starts from the correct merged base and more accurately names the approved scope. No replacement branch is needed.

## 10. Conclusion

The handoff is adopted as an engineering safety reference, not as an authority over later decisions. Its strongest contribution is the invariant and security checklist. Its SQLite and Support-deferral assumptions are superseded.

Implementation must continue from the approved DER and this reconciliation, while preserving the hardened existing lead/media/outbox behavior.
