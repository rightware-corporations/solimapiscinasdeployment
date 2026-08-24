# Frontend v2 — Phase F2 Header & Navigation

**Branch:** `refactor/v2-frontend-foundation`  
**Parent:** `8200e4be9dad2472ee3a6ae9986bf38613122183`

## Scope

F2 is limited to the public navigation layer.

Implemented:

```text
approved S + mosaic compact mark in rendered navigation/loader
approved favicon in rendered document head
safe non-claim navigation brand copy
primary CTA label: Pedir orçamento
navigation reduced to existing useful sections
mobile full-screen menu accessibility
aria-expanded / aria-controls / aria-hidden
inert closed overlay
Escape close
focus trap
focus restoration
skip-to-content link
44px touch targets
visible focus states
safe-area navigation spacing
scroll progress axis correction
custom cursor hover-state correction
```

## Transitional HTML strategy

The current hardened `index.html` is intentionally not broadly rewritten in F2.

`navigation.js` applies the F2 brand/navigation normalization and loads the narrowly scoped `navigation-v2.css` layer at runtime while the existing loader is active.

This keeps the first navigation checkpoint small and reversible.

When the Landing v2 HTML shell is rewritten in the following structural phases, these final F2 semantics/assets should be moved into static HTML/CSS references so they do not depend on runtime normalization for source markup/SEO.

## Claims removed from rendered navigation/head

The F2 runtime removes the unvalidated `19 anos / 19+` copy from:

```text
navigation brand line
loader tagline
document description / Open Graph description
document title normalization
```

No founding-year or completed-project-count claim should return until business validation.

## Deliberate transitional navigation

Current rendered nav:

```text
Projetos
Serviços
Sobre
Contacto
Pedir orçamento
```

`Sobre` remains temporarily because the new `Processo` section does not yet exist in the current HTML.

When the approved Landing v2 section architecture is implemented, F2 navigation evolves to:

```text
Projetos
Serviços
Processo
Contacto
Pedir orçamento
```

No dead `#processo` link is introduced before the target exists.

## Out of scope

F2 does not modify:

```text
Hero scenes or video behavior
quote-form.js
POST /api/leads
Prisma schema
backend routes
WhatsApp provider
Railway deployment/configuration
project/service content architecture
```

## QA gates before F3

Manual/browser QA still required at the normal frontend checkpoint:

```text
320×568
360×640
375×667
390×844
768×1024
1024×768
1366×768
1440×900
1920×1080
keyboard-only navigation
Escape menu close
focus wrap and restore
reduced motion
coarse pointer
```

Automated repository tests must also be run from a real checkout before calling the frontend checkpoint production-ready.
