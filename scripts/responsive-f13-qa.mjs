import { once } from "node:events";
import { chromium } from "playwright";
import { createTestSystem } from "../tests/support.js";

const viewports = [
  { name: "320x568", width: 320, height: 568, kind: "phone" },
  { name: "360x640", width: 360, height: 640, kind: "phone" },
  { name: "375x667", width: 375, height: 667, kind: "phone" },
  { name: "390x844", width: 390, height: 844, kind: "phone" },
  { name: "414x896", width: 414, height: 896, kind: "phone" },
  { name: "600x960", width: 600, height: 960, kind: "phone" },
  { name: "768x1024", width: 768, height: 1024, kind: "tablet" },
  { name: "820x1180", width: 820, height: 1180, kind: "tablet" },
  { name: "1024x768", width: 1024, height: 768, kind: "tablet" },
  { name: "1366x768", width: 1366, height: 768, kind: "desktop" },
  { name: "1440x900", width: 1440, height: 900, kind: "desktop" },
  { name: "1920x1080", width: 1920, height: 1080, kind: "desktop" },
];

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
      try {
        Object.defineProperty(navigator, "connection", {
          configurable: true,
          value: { saveData: true },
        });
      } catch {}
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
    await page.locator("[data-sticky-v2]").waitFor({ state: "attached", timeout: 5_000 });
    await page.waitForTimeout(180);

    const metrics = await page.evaluate(() => {
      const sectionSelectors = [
        ".hero",
        "[data-proof-v2]",
        "[data-projects-v2]",
        "[data-services-v2]",
        "[data-why-v2]",
        "[data-process-v2]",
        "[data-clients-v2]",
        "[data-quote-v2]",
        "#contacto",
      ];
      const sections = sectionSelectors.map((selector) => document.querySelector(selector));
      const sectionTops = sections.map((section) => section?.getBoundingClientRect().top + scrollY ?? -1);
      const sectionWidths = sections.map((section) => {
        if (!section) return { selector: "missing", inside: false, overflow: 999 };
        const rect = section.getBoundingClientRect();
        return {
          selector: section.id ? `#${section.id}` : section.className,
          inside: rect.left >= -1 && rect.right <= innerWidth + 1,
          overflow: Math.max(0, section.scrollWidth - section.clientWidth),
        };
      });

      const nav = document.querySelector("#nav");
      const navRect = nav?.getBoundingClientRect();
      const heroQuote = document.querySelector(".hero-quote-cta");
      const heroQuoteRect = heroQuote?.getBoundingClientRect();
      const heroProject = document.querySelector(".hero-project-cta");
      const heroProjectRect = heroProject?.getBoundingClientRect();
      const sticky = document.querySelector("[data-sticky-v2]");

      const visibleInteractive = [...document.querySelectorAll(
        ".hero-ctas a, .nav-cta, .nav-burger, .project-v2-quote-cta, .service-v2-quote-cta, .process-v2-cta, .sticky-v2-cta, .form-actions .btn, .quote-v2-task-close, .contact-v2-phone, .contact-v2-primary"
      )].filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      }).map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label: element.getAttribute("aria-label") || element.textContent?.replace(/\s+/g, " ").trim().slice(0, 50) || element.className,
          width: rect.width,
          height: rect.height,
        };
      });

      const stickyStyle = sticky ? getComputedStyle(sticky) : null;
      return {
        sectionCount: sections.filter(Boolean).length,
        sectionTops,
        sectionWidths,
        documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        bodyOverflow: Math.max(0, document.body.scrollWidth - innerWidth),
        navInside: Boolean(navRect) && navRect.left >= -1 && navRect.right <= innerWidth + 1,
        navHeight: navRect?.height || 0,
        heroQuoteVisible: Boolean(heroQuoteRect) && heroQuoteRect.width > 0 && heroQuoteRect.height > 0,
        heroQuoteBottom: heroQuoteRect?.bottom ?? 9999,
        heroQuoteHeight: heroQuoteRect?.height ?? 0,
        heroProjectHeight: heroProjectRect?.height ?? 0,
        heroMode: document.querySelector(".hero")?.dataset.heroMode || "",
        visibleInteractive,
        stickyRendered: Boolean(sticky),
        stickyDisplay: stickyStyle?.display || "",
      };
    });

    const failures = [];
    if (metrics.sectionCount !== 9) failures.push(`expected 9 primary sections, got ${metrics.sectionCount}`);
    const sorted = metrics.sectionTops.every((value, index, all) => index === 0 || value > all[index - 1]);
    if (!sorted) failures.push(`primary section order is not monotonic: ${metrics.sectionTops.join(", ")}`);
    if (metrics.documentOverflow > 1 || metrics.bodyOverflow > 1) failures.push(`global horizontal overflow doc=${metrics.documentOverflow}px body=${metrics.bodyOverflow}px`);
    for (const section of metrics.sectionWidths) {
      if (!section.inside) failures.push(`section exceeds viewport: ${section.selector}`);
      if (section.overflow > 1) failures.push(`section internal horizontal overflow ${section.overflow}px: ${section.selector}`);
    }
    if (!metrics.navInside) failures.push("navigation exceeds viewport width");
    if (!metrics.heroQuoteVisible) failures.push("primary Hero quote CTA is not visible");
    if (viewport.kind === "phone" && viewport.height <= 680 && metrics.heroQuoteBottom > viewport.height + 1) failures.push(`primary Hero quote CTA falls below compact fold: bottom=${metrics.heroQuoteBottom}px`);
    if (metrics.heroQuoteHeight < 44) failures.push(`primary Hero quote CTA below 44px: ${metrics.heroQuoteHeight}px`);
    if (metrics.heroProjectHeight && metrics.heroProjectHeight < 44) failures.push(`secondary Hero CTA below 44px: ${metrics.heroProjectHeight}px`);

    if (viewport.kind !== "desktop") {
      const undersized = metrics.visibleInteractive.filter((item) => item.height < 44 || item.width < 44);
      if (undersized.length) failures.push(`touch targets below 44px: ${undersized.map((item) => `${item.label}=${Math.round(item.width)}x${Math.round(item.height)}`).join(" | ")}`);
    }

    if (viewport.width >= 768 && metrics.stickyDisplay !== "none") failures.push("mobile sticky is rendered on tablet/desktop");
    if (consoleErrors.length) failures.push(`console errors: ${consoleErrors.join(" | ")}`);

    results.push({ ...viewport, heroMode: metrics.heroMode, failures, passed: failures.length === 0 });
    await context.close();
  }

  const failed = results.filter((result) => !result.passed);
  console.log(JSON.stringify({
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    failures: failed.map(({ name, failures }) => ({ name, failures })),
  }, null, 2));
  if (failed.length) process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  if (server) await new Promise((resolve) => server.close(resolve));
  await system?.close().catch(() => {});
}
