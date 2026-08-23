import { initNavigation } from "./navigation.js";
import { initHeroV2, prepareHeroForV2 } from "./hero-v2.js";
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

window.lucide?.createIcons();
