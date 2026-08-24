export const HERO_MODE = Object.freeze({
  SCROLL_CINEMA: "SCROLL_CINEMA",
  AMBIENT_VIDEO: "AMBIENT_VIDEO",
  STATIC_PREMIUM: "STATIC_PREMIUM",
});

function media(query) {
  return typeof matchMedia === "function" ? matchMedia(query) : null;
}

function saveDataEnabled() {
  return typeof navigator !== "undefined" && navigator.connection?.saveData === true;
}

export function getHeroCapability({ ambientVideoAvailable = true, videoUnavailable = false } = {}) {
  const reducedMotion = media("(prefers-reduced-motion: reduce)")?.matches === true;
  const desktopCinema = media("(min-width: 1180px) and (min-height: 620px)")?.matches === true;
  const finePointer = media("(hover: hover) and (pointer: fine)")?.matches === true;
  const saveData = saveDataEnabled();

  if (reducedMotion || saveData || videoUnavailable) {
    return {
      mode: HERO_MODE.STATIC_PREMIUM,
      reducedMotion,
      saveData,
      reason: reducedMotion ? "reduced-motion" : saveData ? "save-data" : "video-unavailable",
    };
  }

  if (desktopCinema && finePointer) {
    return {
      mode: HERO_MODE.SCROLL_CINEMA,
      reducedMotion: false,
      saveData: false,
      reason: "desktop-capable",
    };
  }

  if (ambientVideoAvailable) {
    return {
      mode: HERO_MODE.AMBIENT_VIDEO,
      reducedMotion: false,
      saveData: false,
      reason: "ambient-capable",
    };
  }

  return {
    mode: HERO_MODE.STATIC_PREMIUM,
    reducedMotion: false,
    saveData: false,
    reason: "no-ambient-source",
  };
}

export function watchHeroCapability(callback) {
  if (typeof callback !== "function") return () => {};

  const queries = [
    media("(prefers-reduced-motion: reduce)"),
    media("(min-width: 1180px) and (min-height: 620px)"),
    media("(hover: hover) and (pointer: fine)"),
  ].filter(Boolean);

  const notify = () => callback();
  queries.forEach((query) => query.addEventListener?.("change", notify));

  if (typeof navigator !== "undefined") {
    navigator.connection?.addEventListener?.("change", notify);
  }
  if (typeof addEventListener === "function") {
    addEventListener("orientationchange", notify, { passive: true });
  }

  return () => {
    queries.forEach((query) => query.removeEventListener?.("change", notify));
    if (typeof navigator !== "undefined") {
      navigator.connection?.removeEventListener?.("change", notify);
    }
    if (typeof removeEventListener === "function") {
      removeEventListener("orientationchange", notify);
    }
  };
}
