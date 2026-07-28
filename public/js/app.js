import { initNavigation } from "./navigation.js";
import { initLoader, initMotion, initSmoothScroll } from "./motion.js";
import "./quote-form.js";

initLoader();
initSmoothScroll();
initNavigation();
initMotion();
window.lucide?.createIcons();
