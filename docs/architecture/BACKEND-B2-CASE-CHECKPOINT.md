# SOLIMA Backend B2 — Case Core Checkpoint

Date: 2026-08-31

## Scope

- Additive `Case` operational aggregate.
- Atomic `FORM → LeadSubmission + Case` linkage.
- Domain support for manually associating a WhatsApp `Intent` with one `Case`.
- Official upload limits: 3 location, 2 inspiration, 5 total.

## Invariants

- `LeadSubmission` remains the original intake record.
- Form retries reuse the existing submission and cannot create a duplicate Case.
- One form submission has at most one source Case.
- One Intent has at most one associated Case.
- `type` and `channel` remain separate fields.
- `Intent.convertedAt` is set only when staff creates the associated Case, never on CTA click.
- Manual WhatsApp Case creation is a domain service only; no unauthenticated Admin route is exposed before the security milestone.
- Source relations use `ON DELETE RESTRICT`.

## Preserved

- Legacy WhatsApp delivery creation, runner, Meta adapter and webhook.
- Lead fingerprint and idempotency key behavior.
- Existing image processing pipeline.
- No Railway, OpenWA or deployment changes.

## Next gate

B3 adds `NotificationDelivery` and email delivery after commit. Legacy `WhatsAppDelivery` remains present while new form submissions are switched explicitly and safely.
