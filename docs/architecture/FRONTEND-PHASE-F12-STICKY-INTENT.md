# Frontend v2 — Phase F12 Sticky / Intent

**Status:** implementation checkpoint

## Goal

Provide one contextual mobile conversion affordance without creating a second form or a second intent system.

## Contract

```text
Hero
→ sticky hidden

Projects
→ Quero algo como isto
→ copies the active project's existing PROJECT intent

Services
→ service-specific CTA
→ copies the active service's existing SERVICE intent

Why / Process / Clients
→ Pedir orçamento
→ generic STICKY intent

Quote / Contact / Footer
→ sticky hidden

>= 768px
→ sticky not visibly rendered
```

The sticky reuses the same `#orcamento` Quote Controller introduced in F10.

It does **not**:

```text
create another form
change POST /api/leads
send intent fields to the backend
change Prisma
change Railway
change WhatsApp
```

## Stability

Context is selected from the most visible project/service while the section probe is active. The fixed CTA has a mobile safe-area reserve so it does not become an unaccounted final-page obstruction.

When the quote task opens:

```text
sticky hides
background becomes inert through F10
Escape/close restores the quote trigger focus
```

## QA gate

`scripts/sticky-f12-qa.mjs` verifies:

```text
Hero hidden state
Project context/ref/suggested service
Quote open + sticky hidden
Escape + focus restoration
Service context
Generic context
Quote hidden state
Contact hidden state
44px+ touch target
viewport containment
no horizontal overflow
tablet/desktop hidden state
```
