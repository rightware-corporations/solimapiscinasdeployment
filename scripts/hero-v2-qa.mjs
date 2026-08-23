import fs from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import { chromium } from "playwright";
import { createTestSystem } from "../tests/support.js";

const viewports = [
  { name: "320x568", width: 320, height: 568, kind: "phone" },
  { name: "360x640", width: 360, height: 640, kind: "phone" },
  { name: "375x667", width: 375, height: 667, kind: "phone" },
  { name: "390x844", width: 390, height: 844, kind: "phone" },
  { name: "414x896", width: 414, height: 896, kind: "phone" },
  { name: "768x1024", width: 768, height: 1024, kind: "tablet" },
  { name: "820x1180", width: 820, height: 1180, kind: "tablet" },
  { name: "1024x768", width: 1024, height: 768, kind: "tablet" },
  { name: "1366x768", width: 1366, height: 768, kind: "desktop" },
  { name: "1440x900", width: 1440, height: 900, kind: "desktop" },
  { name: "1920x1080", width: 1920, height: 1080, kind: "desktop" },
];

const motions = ["normal", "reduced"];
const reportRoot = path.resolve(process.env.HERO_QA_REPORT_ROOT || "hero-report-f3");
const executablePath = process.env.BROWSER_PATH || chromium.executablePath();
const results = [];

function contextOptions(viewport, motion) {
  const mobileUA = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
  const tabletUA = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
  return {
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.kind === "phone" ? 2 : viewport.kind === "tablet" ? 1.5 : 1,
    isMobile: viewport.kind === "phone",
    hasTouch: viewport.kind !== "desktop",
    userAgent: viewport.kind === "phone" ? mobileUA : viewport.kind === "tablet" ? tabletUA : undefined,
    reducedMotion: motion === "reduced" ? "reduce" : "no-preference",
  };
}

function expectedMode(viewport, motion) {
  if (motion === "reduced") return "STATIC_PREMIUM";
  if (viewport.kind === "desktop" && viewport.width >= 1180 && viewport.height >= 620) return "SCROLL_CINEMA";
  return "AMBIENT_VIDEO";
}

const rect = (element) => {
  if (!element) return null;
  const value = element.getBoundingClientRect();
  return {
    left: value.left,
    top: value.top,
    right: value.right,
    bottom: value.bottom,
    width: value.width,
    height: value.height,
  };
};

let system;
let server;
let browser;

try {
  await fs.mkdir(reportRoot, { recursive: true });
  system = await createTestSystem();
  server = system.app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseURL = `http://127.0.0.1:${server.address().port}`;

  browser = await chromium.launch({ executablePath, headless: true });

  for (const motion of motions) {
    const motionRoot = path.join(reportRoot, motion);
    await fs.mkdir(motionRoot, { recursive: true });

    for (const viewport of viewports) {
      const context = await browser.newContext(contextOptions(viewport, motion));

      // F3 tests the controller rather than availability of an external Pexels CDN.
      // Stub media playback so capability selection remains deterministic and no
      // external video network dependency can turn AMBIENT_VIDEO into a false failure.
      await context.addInitScript(() => {
        Object.defineProperty(HTMLMediaElement.prototype, "play", {
          configurable: true,
          value() { return Promise.resolve(); },
        });
        Object.defineProperty(HTMLMediaElement.prototype, "pause", {
          configurable: true,
          value() {},
        });
        Object.defineProperty(HTMLMediaElement.prototype, "load", {
          configurable: true,
          value() {},
        });
      });

      const page = await context.newPage();
      const consoleErrors = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => consoleErrors.push(error.message));

      await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.locator("#loader").waitFor({ state: "detached", timeout: 4_000 }).catch(() => {});
      await page.locator(".hero[data-hero-mode]").waitFor({ state: "attached", timeout: 5_000 });
      await page.waitForTimeout(motion === "reduced" ? 80 : 220);

      const expected = expectedMode(viewport, motion);
      const initial = await page.evaluate(({ viewportKind }) => {
        const hero = document.querySelector(".hero");
        const nav = rect(document.querySelector("#nav"));
        const title = rect(document.querySelector(".hero-title"));
        const ctas = rect(document.querySelector(".hero-ctas"));
        const quote = rect(document.querySelector(".hero-quote-cta"));
        const project = rect(document.querySelector(".hero-project-cta"));
        const indicator = document.querySelector(".hero-scene-indicator");
        const topLetterbox = document.querySelector(".hero-letterbox.top");
        const activeWord = document.querySelector(".hero-title-morph-word.is-active")?.textContent?.trim() || null;
        const videos = [...document.querySelectorAll(".hero video")];
        const isVisible = (element) => !!element && getComputedStyle(element).display !== "none" && getComputedStyle(element).visibility !== "hidden";
        return {
          actualMode: hero?.dataset.heroMode || null,
          reason: hero?.dataset.heroModeReason || null,
          horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
          titleClearsNav: !title || !nav ? false : title.top >= nav.bottom - 2,
          ctaBottomSafe: !ctas ? false : ctas.bottom <= innerHeight - 8,
          quotePrimary: document.querySelector(".hero-quote-cta")?.classList.contains("btn-primary") === true,
          quoteBeforeProjectOnPhone: viewportKind !== "phone" || (!!quote && !!project && quote.top <= project.top),
          indicatorVisible: isVisible(indicator),
          letterboxVisible: isVisible(topLetterbox),
          activeWord,
          videoSrcCount: videos.filter((video) => video.getAttribute("src")).length,
          heroHeight: hero?.getBoundingClientRect().height || 0,
          viewportHeight: innerHeight,
        };
      }, { viewportKind: viewport.kind });

      let ambientWordStableOnScroll = true;
      if (expected === "AMBIENT_VIDEO") {
        await page.evaluate(() => window.scrollTo({ top: 80, behavior: "instant" }));
        await page.waitForTimeout(120);
        const afterScrollWord = await page.locator(".hero-title-morph-word.is-active").textContent();
        ambientWordStableOnScroll = afterScrollWord?.trim() === initial.activeWord;
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      }

      let cinemaReachesDetail = true;
      if (expected === "SCROLL_CINEMA") {
        cinemaReachesDetail = await page.evaluate(async () => {
          const hero = document.querySelector(".hero");
          const distance = Math.max(1, hero.offsetHeight - innerHeight);
          const destination = distance * .9;
          if (window.solimaLenis) window.solimaLenis.scrollTo(destination, { immediate: true, force: true });
          else window.scrollTo({ top: destination, behavior: "instant" });
          await new Promise((resolve) => setTimeout(resolve, 160));
          return document.querySelector('.hero-scene-row[data-scene="detail"]')?.classList.contains("is-active") === true &&
            document.querySelector('.hero-title-morph-word[data-scene="detail"]')?.classList.contains("is-active") === true;
        });
        await page.evaluate(() => {
          if (window.solimaLenis) window.solimaLenis.scrollTo(0, { immediate: true, force: true });
          else window.scrollTo({ top: 0, behavior: "instant" });
        });
      }

      const compactPhone = viewport.kind === "phone" && viewport.height <= 680;
      const staticSourcesCleared = expected !== "STATIC_PREMIUM" || initial.videoSrcCount === 0;
      const nonCinemaDecorHidden = expected === "SCROLL_CINEMA" || (!initial.indicatorVisible && !initial.letterboxVisible);

      const failures = [];
      if (initial.actualMode !== expected) failures.push(`mode ${initial.actualMode} != ${expected}`);
      if (initial.horizontalOverflow > 1) failures.push(`horizontal overflow ${initial.horizontalOverflow}px`);
      if (compactPhone && !initial.titleClearsNav) failures.push("title overlaps navigation on compact phone");
      if (compactPhone && !initial.ctaBottomSafe) failures.push("CTA falls below compact-phone viewport");
      if (!initial.quotePrimary) failures.push("quote CTA is not primary");
      if (!initial.quoteBeforeProjectOnPhone) failures.push("quote CTA is not first visual action on phone");
      if (!nonCinemaDecorHidden) failures.push("scene indicator/letterbox visible outside cinema mode");
      if (!ambientWordStableOnScroll) failures.push("ambient word changed because of short scroll");
      if (!cinemaReachesDetail) failures.push("desktop cinema did not reach detail scene");
      if (!staticSourcesCleared) failures.push("static premium retained video src");
      if (consoleErrors.length) failures.push(`console errors: ${consoleErrors.join(" | ")}`);

      const row = {
        motion,
        ...viewport,
        expectedMode: expected,
        ...initial,
        ambientWordStableOnScroll,
        cinemaReachesDetail,
        staticSourcesCleared,
        nonCinemaDecorHidden,
        consoleErrors,
        failures,
        passed: failures.length === 0,
      };
      results.push(row);

      await page.screenshot({
        path: path.join(motionRoot, `${viewport.name}.png`),
        fullPage: false,
        animations: "disabled",
      });

      await context.close();
    }
  }

  const summary = {
    total: results.length,
    passed: results.filter((row) => row.passed).length,
    failed: results.filter((row) => !row.passed).length,
    failures: results.filter((row) => !row.passed).map(({ motion, name, failures }) => ({ motion, name, failures })),
  };

  await fs.writeFile(path.join(reportRoot, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  await fs.writeFile(path.join(reportRoot, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));

  if (summary.failed) process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  if (server) await new Promise((resolve) => server.close(resolve));
  await system?.close().catch(() => {});
}
