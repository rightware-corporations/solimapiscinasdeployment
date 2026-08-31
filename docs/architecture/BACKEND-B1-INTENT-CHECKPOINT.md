# SOLIMA Backend B1 — Intent Foundation Checkpoint

Date: 2026-08-31

## Baseline

- Branch: `refactor/v2-backend-foundation`
- Base: `7d758cf2f771b92d00e1e3b13590d62866e91e58`
- Scope: B1 only
- Railway/OpenWA/deployment: untouched

## Implemented

- Independent additive `Intent` model and migration.
- Strict `POST /api/intents/whatsapp` endpoint.
- Server-owned project/service catalog and source resolution.
- Non-enumerable `SOL-I-` attribution references.
- Server-configured WhatsApp destination and server-built `wa.me` message.
- Contact CTA registers Intent before redirecting.
- Failed attribution requests do not silently redirect.
- Separate rate limit for intent creation.

## Preserved

- `LeadSubmission`, fingerprint, media lifecycle, `WhatsAppDelivery`, Meta adapter/webhook, startup guards, existing migrations and frontend QA assets.

## Explicit non-goals

- No `Case`, `NotificationDelivery`, `Sale`, Admin, OpenWA, Railway or deployment changes.
- No claim that a CTA click created a conversation.

## Next gate

B2 introduces additive `Case` core and idempotency-safe `FORM → Case` linkage without email delivery yet.
