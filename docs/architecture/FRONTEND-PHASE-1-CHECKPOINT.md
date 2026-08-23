# Frontend v2 — Phase F1 foundation checkpoint

**Branch:** `refactor/v2-frontend-foundation`  
**Base commit:** `c3bfec32f55c86b671366b97ab525281b4000f9f`  
**Base message:** `feat: finalize pre-production hardening`

## Scope of this checkpoint

This first change is intentionally non-functional.

It may:

```text
add semantic design tokens
add approved compact SOLIMA SVG assets
document the frontend refactor boundary
```

It must not:

```text
change POST /api/leads
change quote-form behavior
change backend routes
change Prisma schema
change WhatsApp/provider configuration
change Railway configuration
switch the public landing
```

## Compatibility rule

Legacy CSS tokens used by the current hardened landing remain present with unchanged values during F1.

Landing v2 adopts the new semantic tokens section-by-section in later commits.

## Next checkpoint

F2 begins the public header/navigation refactor and integrates the compact mark/favicons only after visual regression review.

The backend and OpenWA tracks remain frozen while this frontend checkpoint is being established.
