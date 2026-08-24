import { once } from "node:events";
import { chromium } from "playwright";
import { createTestSystem } from "../tests/support.js";

const PILLARS = ["Engenharia", "Design", "Tecnologia", "Durabilidade", "Acompanhamento"];
const forbiddenClaims = /(?:desde\s+2006|19\+|mais\s+de\s+19\s+anos|32\+|01\s*\/\s*32|100%|45\s+dias)/iu;

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
    await page.locator("[data-why-v2]").waitFor({ state: "attached", timeout: 5_000 });
    await page.waitForTimeout(140);

    const metrics = await page.evaluate(({ width }) => {
      const services = document.querySelector("[data-services-v2]");
      const section = document.querySelector("[data-why-v2]");
      const inner = section.querySelector(".why-v2-inner");
      const header = section.querySelector(".why-v2-header");
      const rect = section.getBoundingClientRect();
      const innerStyle = getComputedStyle(inner);
      const gridColumns = innerStyle.gridTemplateColumns.split(" ").filter(Boolean).length;
      const pillarTitles = [...section.querySelectorAll(".why-v2-pillar-title")].map((node) => node.textContent?.trim() || "");
      const pillarAnimations = [...section.querySelectorAll(".why-v2-pillar")].map((node) => getComputedStyle(node).animationName);
      const navAboutLabels = [...document.querySelectorAll('.nav-link[href="#sobre"], .nav-overlay-link[href="#sobre"]')]
        .map((node) => node.textContent?.trim() || "");

      return {
        styleLoaded: Boolean(document.querySelector('link[data-solima-why-v2]')),
        immediatelyAfterServices: services?.nextElementSibling === section,
        uniqueSobre: document.querySelectorAll("#sobre").length,
        uniqueVisaoAlias: document.querySelectorAll("#visao").length,
        visaoAliasInsideWhy: section.querySelector("#visao")?.parentElement === section,
        legacyStorySections: document.querySelectorAll("section.sobre, section.inspiracao, section.lazer, section.visao").length,
        title: section.querySelector("#whyV2Title")?.textContent?.replace(/\s+/g, " ").trim() || "",
        eyebrow: section.querySelector(".why-v2-eyebrow")?.textContent?.trim() || "",
        pillarTitles,
        sustainabilityLabel: section.querySelector(".why-v2-sustainability strong")?.textContent?.trim() || "",
        sustainabilityText: section.querySelector(".why-v2-sustainability p")?.textContent?.trim() || "",
        whyText: section.textContent?.replace(/\s+/g, " ").trim() || "",
        socialProgramInWhy: /Nadando para o Futuro/i.test(section.textContent || ""),
        navAboutLabels,
        legacyVisaoNavLinks: document.querySelectorAll('.nav-link[href="#visao"], .nav-overlay-link[href="#visao"]').length,
        gridColumns,
        headerPosition: getComputedStyle(header).position,
        horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
        sectionInsideViewport: rect.left >= -1 && rect.right <= innerWidth + 1,
        pillarAnimations,
        width,
      };
    }, { width: viewport.width });

    const failures = [];
    if (!metrics.styleLoaded) failures.push("Why SOLIMA stylesheet not loaded");
    if (!metrics.immediatelyAfterServices) failures.push("Why SOLIMA is not immediately after Services");
    if (metrics.uniqueSobre !== 1) failures.push(`expected one #sobre anchor, got ${metrics.uniqueSobre}`);
    if (metrics.uniqueVisaoAlias !== 1 || !metrics.visaoAliasInsideWhy) failures.push("legacy #visao deep-link alias is not preserved inside Why SOLIMA");
    if (metrics.legacyStorySections !== 0) failures.push(`legacy story sections still rendered: ${metrics.legacyStorySections}`);
    if (metrics.eyebrow !== "Porquê SOLIMA") failures.push(`unexpected Why eyebrow: ${metrics.eyebrow}`);
    if (metrics.title !== "Uma piscina bonita começa muito antes da água.") failures.push(`unexpected Why title: ${metrics.title}`);
    if (JSON.stringify(metrics.pillarTitles) !== JSON.stringify(PILLARS)) failures.push(`pillar order mismatch: ${metrics.pillarTitles.join(" | ")}`);
    if (metrics.sustainabilityLabel !== "Sustentabilidade transversal") failures.push(`unexpected sustainability label: ${metrics.sustainabilityLabel}`);
    if (!/água e energia/i.test(metrics.sustainabilityText) || !/quando aplicável/i.test(metrics.sustainabilityText)) failures.push("sustainability copy is missing the scoped water/energy wording");
    if (forbiddenClaims.test(metrics.whyText)) failures.push("Why SOLIMA contains an unvalidated quantified claim");
    if (metrics.socialProgramInWhy) failures.push("Nadando para o Futuro was incorrectly folded into Why SOLIMA");
    if (metrics.navAboutLabels.length !== 2 || metrics.navAboutLabels.some((label) => label !== "Porquê SOLIMA")) failures.push(`navigation label not normalized: ${metrics.navAboutLabels.join(" | ")}`);
    if (metrics.legacyVisaoNavLinks !== 0) failures.push("legacy Visão navigation link is still exposed");
    if (viewport.width >= 900 && metrics.gridColumns !== 2) failures.push(`desktop/landscape Why layout expected 2 columns, got ${metrics.gridColumns}`);
    if (viewport.width < 900 && metrics.gridColumns !== 1) failures.push(`phone/tablet Why layout expected 1 column, got ${metrics.gridColumns}`);
    if (viewport.width >= 900 && metrics.headerPosition !== "sticky") failures.push(`wide Why header expected sticky, got ${metrics.headerPosition}`);
    if (viewport.width < 900 && metrics.headerPosition !== "static") failures.push(`compact Why header expected static, got ${metrics.headerPosition}`);
    if (metrics.pillarAnimations.some((name) => name !== "none")) failures.push(`Why pillar has unintended animation: ${metrics.pillarAnimations.join(", ")}`);
    if (metrics.horizontalOverflow > 1) failures.push(`horizontal overflow ${metrics.horizontalOverflow}px`);
    if (!metrics.sectionInsideViewport) failures.push("Why SOLIMA exceeds viewport width");
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
