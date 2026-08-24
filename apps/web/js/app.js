import { initNavigation } from "./navigation.js";
import { initHeroV2, prepareHeroForV2 } from "./hero-v2.js";
import { initProofV2 } from "./proof-v2.js";
import { initProjectsV2 } from "./projects-v2.js";
import { initServicesV2 } from "./services-v2.js";
import { initWhyV2 } from "./why-v2.js";
import { initProcessV2 } from "./process-v2.js";
import { initClientsV2 } from "./clients-v2.js";
import { initQuoteV2 } from "./quote-v2.js";
import { initContactV2 } from "./contact-v2.js";
import { initStickyV2 } from "./sticky-v2.js";
import { initLoader, initMotion, initSmoothScroll } from "./motion.js";
import "./quote-form.js";

initLoader();
initSmoothScroll();
initNavigation();

// Phase F3: keep the legacy motion module for all non-hero behavior while
// preventing only its old scroll-driven hero initializer from attaching.
const restoreHeroContent = prepareHeroForV2();
initMotion();
restoreHeroContent();
initHeroV2();

// Phase F4: low-energy trust layer between Hero and the existing content.
// No unvalidated project-count, age, delivery-time, or absolute claims.
initProofV2();

// Phase F5: preserve the six existing portfolio stories, separate service
// taxonomy from theme, move Projects directly after Proof and expose a
// contextual quote CTA without changing the lead API contract yet.
initProjectsV2();

// Phase F6: make service choice intent-led and semantic. Cards are no longer
// giant buttons; detail controls and contextual quote CTAs are separate.
initServicesV2();

// Phase F7: consolidate Sobre, Inspiração, Lazer and Visão into one calm,
// factual capability layer with five clear pillars and no business-number claims.
initWhyV2();

// Phase F8: make the delivery journey explicit, move reassurance out of the
// quote card, and keep timing/guarantee copy factual rather than absolute.
initProcessV2();

// Phase F9: merge legacy audience/client blocks into one restrained institutional
// proof layer, with markets first, neutral references and a separate social note.
initClientsV2();

// Phase F10: keep one hardened lead form/API while presenting it as a focused,
// contextual task when the visitor arrives from a project, service or CTA.
initQuoteV2();

// Phase F11: replace the legacy contact/footer runtime with factual contact
// channels, no assumed public WhatsApp, no experience-age claims and no Admin link.
initContactV2();

// Phase F12: one mobile-only contextual conversion affordance. It reuses the
// existing project/service intent attributes and disappears for quote/contact.
initStickyV2();

window.lucide?.createIcons();
