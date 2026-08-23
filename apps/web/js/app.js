import { initNavigation } from "./navigation.js";
import { initHeroV2, prepareHeroForV2 } from "./hero-v2.js";
import { initProofV2 } from "./proof-v2.js";
import { initProjectsV2 } from "./projects-v2.js";
import { initServicesV2 } from "./services-v2.js";
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

window.lucide?.createIcons();
