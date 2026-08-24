# Frontend v2 — Phase F3 Hero capability checkpoint

**Branch:** `refactor/v2-frontend-foundation`

## Goal

Replace the one-size-fits-all scroll-driven Hero controller with three explicit capability modes without changing the quote form, backend, database, Railway or WhatsApp integration.

## Modes

```text
SCROLL_CINEMA
→ desktop >=1180px
→ minimum useful height
→ fine pointer
→ motion allowed
→ Save-Data off

AMBIENT_VIDEO
→ mobile/tablet and non-cinema capable layouts
→ one ambient water/pool scene
→ headline words change by time, never by scroll

STATIC_PREMIUM
→ prefers-reduced-motion
→ Save-Data
→ missing video source
→ autoplay/video failure
```

## Legacy isolation

`motion.js` is deliberately not rewritten in this checkpoint.

The F3 bootstrap temporarily renames `#heroContent` only while `initMotion()` runs. That makes the old `initHero()` return early while preserving:

```text
image assignment
reveal observers
parallax
project rail
mobile project reveals
```

Then the v2 Hero controller starts against the restored DOM.

This is temporary compatibility architecture. The old hero function can be removed later when the wider motion module is decomposed.

## Mobile behavior

```text
one scene
one video source
poster fallback
muted
playsinline
loop
quote CTA first
Ver projetos second
no scroll-driven scene switching
no scene indicator
no letterbox
```

Compact-height tiers reduce copy/spacing so the primary CTA remains usable on 360×640 / 375×667 class devices.

## Desktop behavior

`SCROLL_CINEMA` uses a 300svh track with a sticky 100svh visual.

The three existing scenes crossfade continuously using normalized scroll progress. Text scene selection follows the nearest scene instead of mobile-sized threshold jumps.

## Video lifecycle

The controller:

```text
loads sources only for the selected capability mode
pauses video when the Hero leaves the viewport
pauses video while the document is hidden
removes video sources in STATIC_PREMIUM
falls back to static poster if autoplay fails
```

## Copy safety

During F3 startup the rendered Hero removes unvalidated experience claims and uses:

```text
Piscinas · Maputo · Moçambique

Construção, modernização e manutenção de piscinas para espaços
residenciais, comerciais e institucionais em Moçambique.
```

The legacy HTML source still contains old section copy that will be replaced as the Landing v2 markup is refactored. No new unvalidated numerical claim is introduced.

## Temporary ambient-video asset

F3 uses the first existing Hero water/pool video as the ambient source when video is allowed.

This proves the architecture but is **not** the final mobile delivery asset.

Before Landing v2 production cutover, replace it with the approved optimized mobile asset:

```text
vertical/mobile-friendly composition
short seamless loop
muted H.264 MP4
poster fallback
performance target reviewed on real mobile network/device
```

## Out of scope

F3 does not change:

```text
POST /api/leads
quote-form.js
Prisma
LeadSubmission
WhatsAppDelivery
Meta/OpenWA
Railway configuration
Projects UX
Services UX
Proof strip
```

## QA gate

Required before F3 is considered visually complete:

```text
320×568
360×640
375×667
390×844
414×896
768×1024
820×1180
1024×768
1366×768
1440×900
1920×1080

normal motion
reduced motion
video/autoplay failure
Save-Data/static fallback where testable
```
