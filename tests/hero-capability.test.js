import test from "node:test";
import assert from "node:assert/strict";
import { HERO_MODE, getHeroCapability } from "../apps/web/js/capability.js";

function withCapabilityEnvironment({ reducedMotion = false, desktopCinema = false, finePointer = false, saveData = false }, run) {
  const originalMatchMedia = Object.getOwnPropertyDescriptor(globalThis, "matchMedia");
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    value(query) {
      if (query.includes("prefers-reduced-motion")) return { matches: reducedMotion };
      if (query.includes("min-width: 1180px")) return { matches: desktopCinema };
      if (query.includes("hover: hover")) return { matches: finePointer };
      return { matches: false };
    },
  });

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { connection: { saveData } },
  });

  try {
    return run();
  } finally {
    if (originalMatchMedia) Object.defineProperty(globalThis, "matchMedia", originalMatchMedia);
    else delete globalThis.matchMedia;

    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else delete globalThis.navigator;
  }
}

test("hero capability selects desktop cinema only for capable fine-pointer desktop", () => {
  withCapabilityEnvironment({ desktopCinema: true, finePointer: true }, () => {
    assert.deepEqual(getHeroCapability(), {
      mode: HERO_MODE.SCROLL_CINEMA,
      reducedMotion: false,
      saveData: false,
      reason: "desktop-capable",
    });
  });
});

test("hero capability selects ambient video for phone/tablet capability", () => {
  withCapabilityEnvironment({}, () => {
    assert.equal(getHeroCapability().mode, HERO_MODE.AMBIENT_VIDEO);
    assert.equal(getHeroCapability().reason, "ambient-capable");
  });
});

test("hero capability fails closed to static premium for reduced motion", () => {
  withCapabilityEnvironment({ desktopCinema: true, finePointer: true, reducedMotion: true }, () => {
    const capability = getHeroCapability();
    assert.equal(capability.mode, HERO_MODE.STATIC_PREMIUM);
    assert.equal(capability.reason, "reduced-motion");
  });
});

test("hero capability fails closed to static premium for Save-Data", () => {
  withCapabilityEnvironment({ desktopCinema: true, finePointer: true, saveData: true }, () => {
    const capability = getHeroCapability();
    assert.equal(capability.mode, HERO_MODE.STATIC_PREMIUM);
    assert.equal(capability.reason, "save-data");
  });
});

test("hero capability fails closed after video failure", () => {
  withCapabilityEnvironment({}, () => {
    const capability = getHeroCapability({ videoUnavailable: true });
    assert.equal(capability.mode, HERO_MODE.STATIC_PREMIUM);
    assert.equal(capability.reason, "video-unavailable");
  });
});

test("hero capability uses static premium when no ambient source exists", () => {
  withCapabilityEnvironment({}, () => {
    const capability = getHeroCapability({ ambientVideoAvailable: false });
    assert.equal(capability.mode, HERO_MODE.STATIC_PREMIUM);
    assert.equal(capability.reason, "no-ambient-source");
  });
});
