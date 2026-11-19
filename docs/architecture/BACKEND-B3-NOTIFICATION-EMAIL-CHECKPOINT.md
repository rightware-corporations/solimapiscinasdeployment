# B3 checkpoint — NotificationDelivery and email

Date: 2026-09-01  
Status: PASS

## Delivered

- Added `NotificationDelivery` without deleting or repurposing `WhatsAppDelivery`.
- FORM now creates `LeadSubmission`, processed `LeadMedia`, `Case` and one deduplicated EMAIL notification in the same database transaction.
- New FORM submissions create no Meta/WhatsApp delivery.
- Added asynchronous claim/recovery/retry/terminal-failure processing with a six-attempt ceiling.
- Added an SMTP adapter and an isolated fake adapter for CI.
- Email messages contain text/plain and escaped text/html representations.
- To, From, subject prefix, SMTP credentials and attachment ceiling are server configuration only.
- Processed JPEGs from the existing media pipeline are attached directly; original uploads are never attached.
- Lead and Case remain committed when email delivery fails.
- Existing WhatsApp outbox, adapter, runner and webhook remain operational for legacy records.
- Production startup now fails closed on missing email/SMTP configuration and does not require Meta unless the legacy provider is explicitly enabled.

## Safety decisions

- No OpenWA was provisioned.
- No Railway or production deployment was performed.
- No legacy table or backend path was deleted.
- Accepted email does not delete local processed media. Durable private media lifecycle moves to B4.
- No provider secret, raw message body or attachment content is stored in `NotificationDelivery`.

## Verification

- Prisma schema validation: PASS.
- Full additive SQLite migration chain: PASS.
- Backend/frontend regression suite: 37/37 PASS.
- Email retries, terminal failure, backlog drain, escaped HTML, attachments and legacy WhatsApp coverage: PASS.
- `git diff --check`: PASS.

## Gate for B4

B4 may begin additively with private durable media storage, authorization and signed/proxied retrieval. It must preserve the processed JPEG contract used by B3 and must not expose storage keys publicly.
