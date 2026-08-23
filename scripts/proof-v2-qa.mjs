import { once } from "node:events";
import { chromium } from "playwright";
import { createTestSystem } from "../tests/support.js";

const viewports = [
  { name: "320x568", width: 320, height: 568, kind: "phone" },
  { name: "390x844", width: 390, height: 844, kind: "phone" },
  { name: "844x390", width: 844, height: 390, kind: "tablet" },
  { name: "768x1024", width: 768, height: 1024, kind: "tablet" },
  { name: "1440x900", width: 1440, height: 900, kind: "desktop" },
  { name: "1920x1080", width: 1920, height: 1080, kind: "desktop" },
];

const forbiddenClaims = /(desde\s+2006|19\+|32\+|100%|45\s*dias)/i;
const executablePath = process.env.BROWSER_PATH || chromium.executablePath();

function contextOptions(viewport) {
  const phone = viewport.kind === "phone";
  const tablet = viewport.kind === "tablet";
  return {
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: phone ? 2 : tablet ? 1.5 : 1,
    isMobile: phone,
    hasTouch: phone || tablet,
  };
}

let system;
let server;
let browser;
const results = [];

try {
  system = await createTestSystem();
  server = system.app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseURL = `http://127.0.0.1:${server.address().port}`;

  browser = await chromium.launch({ executablePath, headless: true });

  for (const viewport of viewports) {
    const context = await browser.newContext(contextOptions(viewport));
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
    await page.locator("[data-proof-v2]").waitFor({ state: "attached", timeout: 5_000 });
    await page.waitForTimeout(120);

    const metrics = await page.evaluate(({ kind }) => {
      const hero = document.querySelector(".hero");
      const proof = document.querySelector("[data-proof-v2]");
      const items = [...document.querySelectorAll(".proof-v2-item")];
      const itemRects = items.map((item) => {
        const rect = item.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      });
      const proofRect = proof?.getBoundingClientRect();
      const text = proof?.textContent?.replace(/\s+/g, " ").trim() || "";
      const mobileComposition = kind !== "phone" || (
        itemRects.length === 3 &&
        Math.abs(itemRects[0].top - itemRects[1].top) < 2 &&
        itemRects[2].top >= Math.max(itemRects[0].bottom, itemRects[1].bottom) - 2 &&
        itemRects[2].left <= itemRects[0].left + 2 &&
        itemRects[2].right >= itemRects[1].right - 2
      );

      return {
        styleLoaded: Boolean(document.querySelector('link[data-solima-proof-v2]')),
        immediatelyAfterHero: hero?.nextElementSibling === proof,
        itemCount: items.length,
        text,
        horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
        proofInsideViewport: Boolean(proofRect) && proofRect.left >= -1 && proofRect.right <= innerWidth + 1,
        mobileComposition,
      };
    }, { kind: viewport.kind });

    const failures = [];
    if (!metrics.styleLoaded) failures.push("proof stylesheet not loaded");
    if (!metrics.immediatelyAfterHero) failures.push("proof strip is not immediately after hero");
    if (metrics.itemCount !== 3) failures.push(`expected 3 proof items, got ${metrics.itemCount}`);
    if (forbiddenClaims.test(metrics.text)) failures.push("proof strip contains an unvalidated claim");
    if (metrics.horizontalOverflow > 1) failures.push(`horizontal overflow ${metrics.horizontalOverflow}px`);
    if (!metrics.proofInsideViewport) failures.push("proof strip exceeds viewport width");
    if (!metrics.mobileComposition) failures.push("phone proof layout is not 2+1");
    if (consoleErrors.length) failures.push(`console errors: ${consoleErrors.join(" | ")}`);

    results.push({ ...viewport, ...metrics, consoleErrors, failures, passed: failures.length === 0 });
    await context.close();
  }

  const failed = results.filter((result) => !result.passed);
  const summary = {
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    failures: failed.map(({ name, failures }) => ({ name, failures })),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failed.length) process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  if (server) await new Promise((resolve) => server.close(resolve));
  await system?.close().catch(() => {});
}
