import { once } from "node:events";
import { chromium } from "playwright";
import { createTestSystem } from "../tests/support.js";

const executablePath = process.env.BROWSER_PATH || chromium.executablePath();

const cases = [
  { name: "320x568", width: 320, height: 568, expected: "AMBIENT_VIDEO" },
  { name: "360x640", width: 360, height: 640, expected: "AMBIENT_VIDEO" },
  { name: "375x667", width: 375, height: 667, expected: "AMBIENT_VIDEO" },
  { name: "390x844", width: 390, height: 844, expected: "AMBIENT_VIDEO" },
  { name: "414x896", width: 414, height: 896, expected: "AMBIENT_VIDEO" },
  { name: "768x1024", width: 768, height: 1024, expected: "AMBIENT_VIDEO" },
  { name: "820x1180", width: 820, height: 1180, expected: "AMBIENT_VIDEO" },
  { name: "1024x768", width: 1024, height: 768, expected: "AMBIENT_VIDEO" },
  { name: "1366x768", width: 1366, height: 768, expected: "SCROLL_CINEMA", fine: true },
  { name: "1440x900", width: 1440, height: 900, expected: "SCROLL_CINEMA", fine: true },
  { name: "1920x1080", width: 1920, height: 1080, expected: "SCROLL_CINEMA", fine: true },
];

const reducedCases = [
  { name: "360x640-reduced", width: 360, height: 640 },
  { name: "390x844-reduced", width: 390, height: 844 },
  { name: "1366x768-reduced", width: 1366, height: 768 },
  { name: "1440x900-reduced", width: 1440, height: 900 },
];

let testSystem;
let server;
let browser;

function contextOptions(testCase, reduced = false) {
  const touch = !testCase.fine;
  return {
    viewport: { width: testCase.width, height: testCase.height },
    hasTouch: touch,
    isMobile: testCase.width <= 430,
    reducedMotion: reduced ? "reduce" : "no-preference",
  };
}

async function inspectHero(page) {
  await page.locator("#loader").waitFor({ state: "detached", timeout: 5_000 }).catch(() => {});
  await page.locator(".hero").waitFor({ state: "visible", timeout: 5_000 });
  await page.waitForTimeout(120);

  return page.evaluate(() => {
    const hero = document.querySelector(".hero");
    const title = document.querySelector(".hero-title")?.getBoundingClientRect();
    const ctas = document.querySelector(".hero-ctas")?.getBoundingClientRect();
    const primary = document.querySelector(".hero-quote-cta")?.getBoundingClientRect();
    const letterbox = [...document.querySelectorAll(".hero-letterbox")].some((element) => getComputedStyle(element).display !== "none");
    const sceneList = document.querySelector(".hero-scene-indicator");
    const sceneListVisible = !!sceneList && getComputedStyle(sceneList).display !== "none" && getComputedStyle(sceneList).visibility !== "hidden";
    const scrollCue = document.querySelector(".hero-scroll-cue");
    const scrollCueVisible = !!scrollCue && getComputedStyle(scrollCue).display !== "none" && getComputedStyle(scrollCue).visibility !== "hidden";
    const activeWords = [...document.querySelectorAll(".hero-title-morph-word.is-active")].length;
    const primaryLabel = document.querySelector(".hero-quote-cta span")?.textContent?.trim();
    const secondaryLabel = document.querySelector(".hero-project-cta span")?.textContent?.trim();
    const eyebrow = document.querySelector("#heroContent .eyebrow")?.textContent?.trim();
    const sub = document.querySelector(".hero-sub")?.textContent?.trim();

    return {
      mode: hero?.dataset.heroMode,
      reason: hero?.dataset.heroModeReason,
      documentMode: document.documentElement.dataset.heroMode,
      titleTop: title?.top ?? null,
      titleBottom: title?.bottom ?? null,
      ctaTop: ctas?.top ?? null,
      ctaBottom: ctas?.bottom ?? null,
      primaryBottom: primary?.bottom ?? null,
      viewportHeight: innerHeight,
      overflowX: document.documentElement.scrollWidth - innerWidth,
      primaryAboveFold: !!primary && primary.bottom <= innerHeight - 8,
      titleBeforeCta: !!title && !!ctas && title.bottom <= ctas.top + 1,
      activeWords,
      primaryLabel,
      secondaryLabel,
      eyebrow,
      sub,
      letterbox,
      sceneListVisible,
      scrollCueVisible,
    };
  });
}

function assert(condition, message, result) {
  if (!condition) {
    const error = new Error(message);
    error.result = result;
    throw error;
  }
}

async function runCase(baseURL, testCase, reduced = false) {
  const context = await browser.newContext(contextOptions(testCase, reduced));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text === "Failed to load resource: net::ERR_FAILED") return;
    errors.push(text);
  });

  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value() {
        this.dispatchEvent(new Event("play"));
        return Promise.resolve();
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value() {
        this.dispatchEvent(new Event("pause"));
      },
    });
  });

  await page.route(/videos\.pexels\.com|player\.vimeo\.com|\.mp4(?:\?|$)/i, (route) => route.abort());
  await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const result = await inspectHero(page);

  const expected = reduced ? "STATIC_PREMIUM" : testCase.expected;
  assert(result.mode === expected, `${testCase.name}: expected ${expected}, got ${result.mode}`, result);
  assert(result.documentMode === expected, `${testCase.name}: root hero mode mismatch`, result);
  assert(result.overflowX <= 1, `${testCase.name}: horizontal overflow ${result.overflowX}px`, result);
  assert(result.activeWords === 1, `${testCase.name}: expected exactly one active morph word`, result);
  assert(result.primaryLabel === "Pedir orçamento", `${testCase.name}: primary CTA label mismatch`, result);
  assert(result.secondaryLabel === "Ver projetos", `${testCase.name}: secondary CTA label mismatch`, result);
  assert(!/2006|19\+|19 anos|19\s+anos/i.test(`${result.eyebrow} ${result.sub}`), `${testCase.name}: unvalidated experience claim still rendered in hero`, result);

  if (testCase.width <= 430 && !reduced) {
    assert(result.primaryAboveFold, `${testCase.name}: primary CTA is not above the fold`, result);
    assert(!result.letterbox, `${testCase.name}: letterbox must be hidden on phone`, result);
    assert(!result.sceneListVisible, `${testCase.name}: scene list must be hidden on phone`, result);
    assert(!result.scrollCueVisible, `${testCase.name}: scroll cue must be hidden on phone`, result);
  }

  if (expected === "SCROLL_CINEMA") {
    assert(result.letterbox, `${testCase.name}: desktop cinema should retain letterbox`, result);
    assert(result.sceneListVisible, `${testCase.name}: desktop cinema scene index should be visible`, result);
  }

  assert(errors.length === 0, `${testCase.name}: console/page errors: ${errors.join(" | ")}`, { ...result, errors });
  await context.close();
  return { name: testCase.name, reduced, ...result };
}

try {
  testSystem = await createTestSystem();
  server = testSystem.app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseURL = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath, headless: true });

  const results = [];
  for (const testCase of cases) {
    results.push(await runCase(baseURL, testCase, false));
  }
  for (const testCase of reducedCases) {
    results.push(await runCase(baseURL, testCase, true));
  }

  console.log(JSON.stringify({ passed: results.length, results }, null, 2));
} catch (error) {
  console.error(error.message);
  if (error.result) console.error(JSON.stringify(error.result, null, 2));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
  if (testSystem) await testSystem.close().catch(() => {});
}
