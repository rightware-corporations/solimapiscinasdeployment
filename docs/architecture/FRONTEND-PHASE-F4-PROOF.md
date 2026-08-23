# Frontend v2 — Phase F4 Proof Strip

**Status:** implemented on `refactor/v2-frontend-foundation`, pending automated checkpoint result at the time of this document commit.

## Purpose

Create a calm trust layer immediately after the Hero without publishing business claims that still require validation.

## Visible proof content

The strip contains exactly three statements:

```text
Maputo · Moçambique
Presença local para conversar, avaliar e acompanhar cada solução.

Construção · Modernização · Manutenção
Serviços claros para criar, melhorar ou cuidar da sua piscina.

Engenharia · Design · Acompanhamento
Uma abordagem integrada, do planeamento à continuidade do projeto.
```

## Deliberately excluded

F4 does not publish or infer:

```text
Desde 2006
19+
32+
100% acompanhamento
45 dias
project totals
years in business
absolute delivery promises
```

Those claims remain blocked until business validation.

## Responsive behavior

```text
desktop/tablet wide
→ 3-column low-energy strip

phone
→ 2 items on first row + 1 full-width item below

320px compact
→ typography tightens without horizontal carousel
```

No mandatory horizontal scrolling is introduced.

## Accessibility

The proof strip is a semantic section with an accessible heading and a real list.
Decorative mosaic markers are `aria-hidden`.
Content does not depend on animation.

## Files

```text
apps/web/css/proof-v2.css
apps/web/js/proof-v2.js
apps/web/js/app.js
scripts/proof-v2-qa.mjs
.github/workflows/frontend-refactor-qa.yml
```

## QA gate

F4 has a dedicated browser QA that checks:

```text
proof exists
proof immediately follows Hero
exactly 3 items
no forbidden/unvalidated claims
no horizontal overflow
proof remains within viewport
phone composition remains 2+1
no console errors
```

The wider automated frontend gate also continues to run:

```text
hardened backend regression
F3 Hero QA
legacy visual QA normal
legacy visual QA reduced
15-viewport matrix merge
```

No Railway, Prisma, lead API, quote-form, Meta, or OpenWA production configuration is changed by F4.
