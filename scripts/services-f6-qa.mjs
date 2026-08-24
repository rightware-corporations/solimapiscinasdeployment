import { once } from "node:events";
import { chromium } from "playwright";
import { createTestSystem } from "../tests/support.js";

const SERVICES = [
  {
    type: "NEW_CONSTRUCTION",
    question: "Ainda não tenho piscina.",
    title: "Construção",
    cta: "Quero construir uma piscina",
  },
  {
    type: "MODERNIZATION",
    question: "Já tenho, mas quero melhorar.",
    title: "Modernização",
    cta: "Quero modernizar a minha piscina",
  },
  {
    type: "MAINTENANCE",
    question: "Já tenho e preciso de cuidar.",
    title: "Manutenção",
    cta: "Quero manutenção",
  },
];

const viewports = [
  { name: "320x568", width: 320, height: 568, kind: "phone" },
  { name: "360x640", width: 360, height: 640, kind: "phone" },
  { name: "375x667", width: 375, height: 667, kind: "phone" },
  { name: "390x844", width: 390, height: 844, kind: "phone" },
  { name: "414x896", width: 414, height: 896, kind: "phone" },
  { name: "768x1024", width: 768, height: 1024, kind: "tablet" },
  { name: "844x390", width: 844, height: 390, kind: "tablet" },
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
    await page.locator("[data-services-v2]").waitFor({ state: "attached", timeout: 5_000 });
    await page.locator(".service-v2-card").first().waitFor({ state: "attached", timeout: 5_000 });
    await page.waitForTimeout(120);

    const initial = await page.evaluate(({ expected, width }) => {
      const projects = document.querySelector("[data-projects-v2]");
      const section = document.querySelector("[data-services-v2]");
      const cards = [...section.querySelectorAll(".service-v2-card")];
      const sectionRect = section.getBoundingClientRect();
      const grid = section.querySelector(".service-v2-grid");
      const gridStyle = getComputedStyle(grid);
      const gridColumns = gridStyle.gridTemplateColumns.split(" ").filter(Boolean).length;
      const cardRects = cards.map((card) => card.getBoundingClientRect());
      const ctaRects = cards.map((card) => card.querySelector(".service-v2-quote-cta")?.getBoundingClientRect());
      const toggleRects = cards.map((card) => card.querySelector(".service-v2-details-toggle")?.getBoundingClientRect());

      return {
        styleLoaded: Boolean(document.querySelector('link[data-solima-services-v2]')),
        immediatelyAfterProjects: projects?.nextElementSibling === section,
        heading: section.querySelector("#servicesV2Title")?.textContent?.replace(/\s+/g, " ").trim() || "",
        cardCount: cards.length,
        legacyWholeCardButtons: section.querySelectorAll("button.servico-card, .servico-card[data-toggle]").length,
        horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
        sectionInsideViewport: sectionRect.left >= -1 && sectionRect.right <= innerWidth + 1,
        cardsInsideViewport: cardRects.every((rect) => rect.left >= -1 && rect.right <= innerWidth + 1),
        gridColumns,
        minCtaHeight: Math.min(...ctaRects.filter(Boolean).map((rect) => rect.height)),
        minToggleHeight: Math.min(...toggleRects.filter(Boolean).map((rect) => rect.height)),
        services: cards.map((card, index) => {
          const cta = card.querySelector(".service-v2-quote-cta");
          const toggle = card.querySelector(".service-v2-details-toggle");
          const details = card.querySelector(".service-v2-details");
          return {
            index: index + 1,
            type: card.dataset.serviceType || "",
            question: card.querySelector(".service-v2-question")?.textContent?.trim() || "",
            title: card.querySelector(".service-v2-title")?.textContent?.trim() || "",
            pointCount: card.querySelectorAll(".service-v2-details li").length,
            ctaLabel: cta?.querySelector("span:first-child")?.textContent?.trim() || "",
            ctaHref: cta?.getAttribute("href") || "",
            intentAction: cta?.dataset.intentAction || "",
            intentSource: cta?.dataset.intentSource || "",
            ctaServiceType: cta?.dataset.serviceType || "",
            toggleHidden: toggle?.hidden === true,
            expanded: toggle?.getAttribute("aria-expanded") || "",
            detailsHidden: details?.hidden === true,
            expectedType: expected[index]?.type || "",
          };
        }),
        mobile: width <= 767,
      };
    }, { expected: SERVICES, width: viewport.width });

    const failures = [];
    if (!initial.styleLoaded) failures.push("services stylesheet not loaded");
    if (!initial.immediatelyAfterProjects) failures.push("Services is not immediately after Projects");
    if (!initial.heading.includes("O que precisa da sua piscina?")) failures.push(`unexpected services heading: ${initial.heading}`);
    if (initial.cardCount !== SERVICES.length) failures.push(`expected ${SERVICES.length} service cards, got ${initial.cardCount}`);
    if (initial.legacyWholeCardButtons !== 0) failures.push("legacy whole-card button remains in Services");
    if (initial.horizontalOverflow > 1) failures.push(`horizontal overflow ${initial.horizontalOverflow}px`);
    if (!initial.sectionInsideViewport || !initial.cardsInsideViewport) failures.push("Services exceeds viewport width");
    if (initial.minCtaHeight < 44) failures.push(`service CTA touch target is ${initial.minCtaHeight}px`);

    if (viewport.width <= 767) {
      if (initial.gridColumns !== 1) failures.push(`phone services grid expected 1 column, got ${initial.gridColumns}`);
      if (initial.minToggleHeight < 44) failures.push(`mobile details toggle is ${initial.minToggleHeight}px`);
    } else if (viewport.width >= 900) {
      if (initial.gridColumns !== 3) failures.push(`landscape/desktop services grid expected 3 columns, got ${initial.gridColumns}`);
    } else if (viewport.height >= viewport.width) {
      if (initial.gridColumns !== 1) failures.push(`portrait tablet services grid expected 1 column, got ${initial.gridColumns}`);
    }

    initial.services.forEach((actual, index) => {
      const expected = SERVICES[index];
      if (actual.type !== expected.type) failures.push(`service ${index + 1} type mismatch: ${actual.type}`);
      if (actual.question !== expected.question) failures.push(`service ${index + 1} question mismatch: ${actual.question}`);
      if (actual.title !== expected.title) failures.push(`service ${index + 1} title mismatch: ${actual.title}`);
      if (actual.pointCount !== 3) failures.push(`service ${index + 1} expected 3 detail points, got ${actual.pointCount}`);
      if (actual.ctaLabel !== expected.cta) failures.push(`service ${index + 1} CTA mismatch: ${actual.ctaLabel}`);
      if (actual.ctaHref !== "#orcamento") failures.push(`service ${index + 1} CTA does not target quote section`);
      if (actual.intentAction !== "QUOTE" || actual.intentSource !== "SERVICE") failures.push(`service ${index + 1} CTA intent metadata incomplete`);
      if (actual.ctaServiceType !== expected.type) failures.push(`service ${index + 1} CTA service context mismatch`);
      if (initial.mobile) {
        if (actual.toggleHidden) failures.push(`service ${index + 1} mobile toggle is hidden`);
        if (actual.expanded !== "false" || !actual.detailsHidden) failures.push(`service ${index + 1} mobile details should start collapsed`);
      } else {
        if (!actual.toggleHidden || actual.detailsHidden) failures.push(`service ${index + 1} non-mobile details should be visible without accordion control`);
      }
    });

    if (viewport.width <= 767) {
      const firstToggle = page.locator(".service-v2-details-toggle").first();
      await firstToggle.click();
      const opened = await page.evaluate(() => {
        const card = document.querySelector(".service-v2-card");
        const toggle = card?.querySelector(".service-v2-details-toggle");
        const details = card?.querySelector(".service-v2-details");
        return {
          expanded: toggle?.getAttribute("aria-expanded"),
          detailsHidden: details?.hidden === true,
          cardExpanded: card?.dataset.expanded,
        };
      });
      if (opened.expanded !== "true" || opened.detailsHidden || opened.cardExpanded !== "true") {
        failures.push("mobile service details toggle does not open its panel correctly");
      }
    }

    if (consoleErrors.length) failures.push(`console errors: ${consoleErrors.join(" | ")}`);

    results.push({ ...viewport, failures, passed: failures.length === 0 });
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
