# SOLIMA Backend — Current-State Architecture Baseline

Status: approved discovery baseline  
Target branch: `feat/postgres-office-support-foundation`  
Initial infrastructure: Railway  
Portability requirement: Railway, VPS or physical Linux server  
Tenancy: single organization — SOLIMA  
Definitive database decision: PostgreSQL  
Initial identity scope: one administrator, extensible to staff later

## 1. Purpose

This document records the backend that exists before the PostgreSQL, SOLIMA Office and Support implementation. It separates verified behavior from planned behavior so that database and service design remain grounded in the current system.

## 2. Current deployment shape

The deployed application is a Node.js 22 / Express 5 monolith that serves the public frontend and API from one process. Prisma currently targets SQLite in a persistent Railway Volume. Processed pending media shares the persistent Volume; raw uploads use temporary storage.

Current production flow:

```text
Browser
  -> POST /api/leads
  -> validation and image processing
  -> SQLite transaction
  -> durable WhatsAppDelivery outbox
  -> in-process delivery runner
  -> Meta WhatsApp Cloud API
  -> signed webhook
  -> delivery-state update
```

## 3. Existing code distribution

- `apps/web`: public landing and three-step quote form.
- `apps/api/src/app.js`: Express composition, security middleware, health, webhooks, API and static assets.
- `apps/api/src/server.js`: configuration, storage probe, Prisma connection, repositories, services, delivery runner and graceful shutdown.
- `apps/api/src/leads`: request parsing, validation, idempotency, repository and lead submission.
- `apps/api/src/media`: upload validation, image processing, local storage and cleanup.
- `apps/api/src/deliveries`: durable WhatsApp outbox runner and recovery.
- `apps/api/src/whatsapp`: Meta Cloud API client, adapter, errors and webhook.
- `apps/api/src/middleware`: request IDs, CSP/security, multipart limits, rate limiting and error boundaries.
- `apps/api/prisma`: Prisma schema and SQLite migration chain.
- `apps/api/tests` and `tests`: backend, migration, media, provider, webhook, capability and regression tests.
- `docs`: production architecture, go-live and frontend evidence.
- `.github/workflows`: automated backend, frontend, accessibility, performance and visual QA.

## 4. Existing domain and persistence

### LeadSubmission

Stores the durable public quote request:

- idempotency key and deterministic fingerprint
- customer name and normalized phone
- location
- requested service
- optional notes
- consent timestamp
- privacy-policy version
- aggregate delivery status
- timestamps

### LeadSubmissionExtra

Stores selected quote extras as a normalized child collection.

### LeadMedia

Stores metadata and lifecycle state for processed images. Raw uploads are temporary and not business records.

### WhatsAppDelivery

Acts as a persistent outbox. Sequence zero is the summary; later sequence numbers are images. It tracks attempts, retries, provider IDs, errors and webhook-derived status.

## 5. Verified business behavior

- A submission requires a UUID idempotency key.
- The same key and same fingerprint replay safely.
- The same key with different content returns a conflict.
- Lead, extras, media and delivery rows are created transactionally.
- A successful API response does not depend on immediate Meta availability.
- Retryable provider errors remain durable.
- Delivery order is preserved.
- Webhook state changes are monotonic.
- Images are validated, re-encoded and stripped of embedded metadata.
- Raw files are cleaned after request completion.
- Accepted image deliveries allow local-file deletion.
- Health verifies database and writable persistent storage.

## 6. Existing security controls

- Helmet and Content Security Policy
- no `X-Powered-By`
- same-origin API; CORS is not opened
- request correlation IDs
- structured error boundary
- upload count, byte, field and pixel limits
- real file-signature validation
- phone and payload validation
- public lead rate limit
- HMAC-SHA256 Meta webhook verification with timing-safe comparison
- production configuration validation
- graceful shutdown and stale-delivery recovery
- privacy-policy version captured with consent

## 7. Current architectural constraints

- Prisma provider is SQLite.
- Application, database and pending media are coupled to one Railway service/Volume.
- The delivery worker is in-process.
- A single application replica is required.
- There is no authenticated administrative surface.
- There is no commercial workflow separate from WhatsApp delivery state.
- Lead intent/context is not persisted as a first-class model.
- There is no support/complaints model or public support endpoint.
- There are no users, sessions, roles, password lifecycle or audit records.
- Attachments have no authenticated administrative access path.
- There is no customer master record; contact details are repeated on submissions.
- Operational alerts for terminal delivery failure are not implemented.
- Backup and restore are documented but require operational verification.

## 8. Approved target boundaries

The target remains a modular monolith with a separable worker, not premature microservices.

Target modules:

- public lead intake
- customer/contact records
- commercial pipeline
- projects and appointments
- support and complaints
- identity and access
- sessions and account security
- audit
- media authorization and retention
- notifications and WhatsApp outbox
- reporting and operational settings

The system is single-tenant. No `tenantId`, organization switcher or cross-company abstraction will be introduced. SOLIMA identity remains an application-level invariant.

## 9. Infrastructure principles

Railway is the initial runtime, but application logic must not import Railway-specific APIs. Deployment-specific values remain environment configuration.

Required portability:

- standard PostgreSQL connection URL
- filesystem/media adapter boundary
- environment-based secrets
- repeatable Prisma migrations
- container-compatible startup
- health/readiness endpoints
- backup and restore runbooks
- future Docker Compose deployment on a physical Linux server

## 10. Decisions deferred until domain modeling

The following must be decided in conceptual and logical modeling before implementation:

- customer deduplication and identity rules
- lead-to-customer conversion
- commercial-stage lifecycle and allowed transitions
- project creation from an approved lead
- support requester identity and ticket protocol
- ticket priority and SLA model
- internal notes versus customer-visible messages
- audit retention
- session duration and recovery
- attachment retention per business object
- deletion/anonymization policy
- notification recipients and escalation
- appointment and site-visit scheduling

## 11. Next controlled step

Produce the conceptual domain model and DER in bounded contexts before changing the Prisma provider or creating PostgreSQL migrations. The conceptual model must be approved before the logical relational model becomes code.
