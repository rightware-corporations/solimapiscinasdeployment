import { once } from "node:events";
import { chromium } from "playwright";
import { createTestSystem } from "../tests/support.js";

const STEP_TITLES = [
  "Conversamos",
  "Avaliamos",
  "Desenvolvemos a solução",
  "Apresentamos a proposta",
  "Executamos",
  "Entregamos e acompanhamos",
];

const ASSURANCE_TITLES = ["Escopo claro", "Cronograma por projeto", "Continuidade técnica"];
const forbiddenClaims = /(?:desde\s+2006|19\+|mais\s+de\s+19\s+anos|32\+|01\s*\/\s*32|100%|45\s+dias|garantia\s+t[eé]cnica)/iu;

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
    await page.locator("[data-process-v2]").waitFor({ state: "attached", timeout: 5_000 });
    await page.waitForTimeout(140);

    const metrics = await page.evaluate(() => {
      const why = document.querySelector("[data-why-v2]");
      const section = document.querySelector("[data-process-v2]");
      const sectionRect = section.getBoundingClientRect();
      const steps = [...section.querySelectorAll(".process-v2-step")];
      const assurances = [...section.querySelectorAll(".process-v2-assurance")];
      const cta = section.querySelector(".process-v2-cta");
      const ctaRect = cta.getBoundingClientRect();
      const quotePromises = document.querySelector(".orcamento-promise");
      const stepGridColumns = getComputedStyle(section.querySelector(".process-v2-steps"))
        .gridTemplateColumns.split(" ").filter(Boolean).length;
      const assuranceGridColumns = getComputedStyle(section.querySelector(".process-v2-assurances"))
        .gridTemplateColumns.split(" ").filter(Boolean).length;

      return {
        styleLoaded: Boolean(document.querySelector('link[data-solima-process-v2]')),
        immediatelyAfterWhy: why?.nextElementSibling === section,
        uniqueProcessAnchor: document.querySelectorAll("#processo").length,
        eyebrow: section.querySelector(".process-v2-eyebrow")?.textContent?.trim() || "",
        title: section.querySelector("#processV2Title")?.textContent?.replace(/\s+/g, " ").trim() || "",
        stepTitles: steps.map((step) => step.querySelector(".process-v2-step-title")?.textContent?.trim() || ""),
        stepDescriptionsComplete: steps.length === 6 && steps.every((step) => (step.querySelector(".process-v2-step-description")?.textContent?.trim().length || 0) >= 40),
        assuranceTitles: assurances.map((item) => item.querySelector("strong")?.textContent?.trim() || ""),
        cronogramaCopy: assurances[1]?.querySelector("p")?.textContent?.trim() || "",
        processText: section.textContent?.replace(/\s+/g, " ").trim() || "",
        stepGridColumns,
        assuranceGridColumns,
        ctaHref: cta?.getAttribute("href") || "",
        ctaIntent: cta?.dataset.intentType || "",
        ctaTouchTarget: ctaRect.width >= 44 && ctaRect.height >= 44,
        quotePromisesHidden: Boolean(quotePromises) && quotePromises.hidden === true && getComputedStyle(quotePromises).display === "none",
        quotePromisesMoved: quotePromises?.hasAttribute("data-moved-to-process") === true,
        horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
        sectionInsideViewport: sectionRect.left >= -1 && sectionRect.right <= innerWidth + 1,
        stepAnimations: steps.map((step) => getComputedStyle(step).animationName),
      };
    });

    const failures = [];
    if (!metrics.styleLoaded) failures.push("Process stylesheet not loaded");
    if (!metrics.immediatelyAfterWhy) failures.push("Process is not immediately after Why SOLIMA");
    if (metrics.uniqueProcessAnchor !== 1) failures.push(`expected one #processo anchor, got ${metrics.uniqueProcessAnchor}`);
    if (metrics.eyebrow !== "Como trabalhamos") failures.push(`unexpected Process eyebrow: ${metrics.eyebrow}`);
    if (metrics.title !== "Clareza em cada etapa, antes da obra.") failures.push(`unexpected Process title: ${metrics.title}`);
    if (JSON.stringify(metrics.stepTitles) !== JSON.stringify(STEP_TITLES)) failures.push(`process step order mismatch: ${metrics.stepTitles.join(" | ")}`);
    if (!metrics.stepDescriptionsComplete) failures.push("one or more Process step descriptions are missing or too short");
    if (JSON.stringify(metrics.assuranceTitles) !== JSON.stringify(ASSURANCE_TITLES)) failures.push(`assurance order mismatch: ${metrics.assuranceTitles.join(" | ")}`);
    if (!/conforme o escopo/i.test(metrics.cronogramaCopy) || !/proposta/i.test(metrics.cronogramaCopy)) failures.push("cronograma assurance is not scoped to project/proposal");
    if (forbiddenClaims.test(metrics.processText)) failures.push("Process contains an unvalidated quantified or guarantee claim");
    if (viewport.width >= 1180 && metrics.stepGridColumns !== 6) failures.push(`wide Process layout expected 6 columns, got ${metrics.stepGridColumns}`);
    if (viewport.width >= 768 && viewport.width < 1180 && metrics.stepGridColumns !== 3) failures.push(`tablet Process layout expected 3 columns, got ${metrics.stepGridColumns}`);
    if (viewport.width < 768 && metrics.stepGridColumns !== 1) failures.push(`phone Process layout expected 1 column, got ${metrics.stepGridColumns}`);
    if (viewport.width >= 768 && metrics.assuranceGridColumns !== 3) failures.push(`wide assurance layout expected 3 columns, got ${metrics.assuranceGridColumns}`);
    if (viewport.width < 768 && metrics.assuranceGridColumns !== 1) failures.push(`phone assurance layout expected 1 column, got ${metrics.assuranceGridColumns}`);
    if (metrics.ctaHref !== "#orcamento" || metrics.ctaIntent !== "PROCESS") failures.push("Process CTA does not preserve generic quote intent");
    if (!metrics.ctaTouchTarget) failures.push("Process CTA touch target is below 44px");
    if (!metrics.quotePromisesHidden || !metrics.quotePromisesMoved) failures.push("legacy quote promises were not moved out of the visible quote card");
    if (metrics.stepAnimations.some((name) => name !== "none")) failures.push(`Process step has unintended animation: ${metrics.stepAnimations.join(", ")}`);
    if (metrics.horizontalOverflow > 1) failures.push(`horizontal overflow ${metrics.horizontalOverflow}px`);
    if (!metrics.sectionInsideViewport) failures.push("Process exceeds viewport width");
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
