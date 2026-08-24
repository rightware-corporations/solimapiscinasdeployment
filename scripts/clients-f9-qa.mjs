import { once } from "node:events";
import { chromium } from "playwright";
import { createTestSystem } from "../tests/support.js";

const MARKET_TITLES = ["Residências", "Condomínios", "Hotelaria", "Educação", "Empreendimentos"];
const REFERENCE_NAMES = ["SS Construções", "Mozago Construções", "Colégio Percia"];
const forbiddenClaims = /(?:desde\s+2006|19\+|mais\s+de\s+19\s+anos|32\+|32\s+piscinas|01\s*\/\s*32|100%|45\s+dias|marca\s+l[ií]der|satisfa[cç][aã]o\s+plena)/iu;

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
    await page.locator("[data-clients-v2]").waitFor({ state: "attached", timeout: 5_000 });
    await page.waitForTimeout(140);

    const metrics = await page.evaluate(() => {
      const process = document.querySelector("[data-process-v2]");
      const section = document.querySelector("[data-clients-v2]");
      const rect = section.getBoundingClientRect();
      const marketGrid = section.querySelector(".clients-v2-markets");
      const markets = [...section.querySelectorAll(".clients-v2-market")];
      const references = [...section.querySelectorAll(".clients-v2-reference")];
      const social = section.querySelector(".clients-v2-social");
      const socialRect = social.getBoundingClientRect();
      const gridColumns = getComputedStyle(marketGrid).gridTemplateColumns.split(" ").filter(Boolean).length;

      return {
        styleLoaded: Boolean(document.querySelector('link[data-solima-clients-v2]')),
        immediatelyAfterProcess: process?.nextElementSibling === section,
        uniqueClientes: document.querySelectorAll("#clientes").length,
        legacyAudienceSections: document.querySelectorAll("section.publico, section.clientes").length,
        eyebrow: section.querySelector(".clients-v2-eyebrow")?.textContent?.trim() || "",
        title: section.querySelector("#clientsV2Title")?.textContent?.replace(/\s+/g, " ").trim() || "",
        marketTitles: markets.map((item) => item.querySelector(".clients-v2-market-title")?.textContent?.trim() || ""),
        marketDescriptionsComplete: markets.length === 5 && markets.every((item) => (item.querySelector(".clients-v2-market-description")?.textContent?.trim().length || 0) >= 45),
        referenceNames: references.map((item) => item.querySelector(".clients-v2-reference-name")?.textContent?.trim() || ""),
        referenceContextsComplete: references.length === 3 && references.every((item) => (item.querySelector(".clients-v2-reference-context")?.textContent?.trim().length || 0) >= 18),
        referenceImages: section.querySelectorAll(".clients-v2-proof img, .clients-v2-proof svg").length,
        referenceLinks: section.querySelectorAll(".clients-v2-reference a").length,
        socialLabel: section.querySelector(".clients-v2-social-label")?.textContent?.trim() || "",
        socialTitle: section.querySelector("#clientsV2SocialTitle")?.textContent?.trim() || "",
        socialText: section.querySelector(".clients-v2-social-text")?.textContent?.trim() || "",
        socialSeparated: Boolean(social) && !social.closest(".clients-v2-proof") && socialRect.width > 0 && socialRect.height > 0,
        clientsText: section.textContent?.replace(/\s+/g, " ").trim() || "",
        gridColumns,
        horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
        sectionInsideViewport: rect.left >= -1 && rect.right <= innerWidth + 1,
        marketAnimations: markets.map((item) => getComputedStyle(item).animationName),
      };
    });

    const failures = [];
    if (!metrics.styleLoaded) failures.push("Clients/Markets stylesheet not loaded");
    if (!metrics.immediatelyAfterProcess) failures.push("Clients/Markets is not immediately after Process");
    if (metrics.uniqueClientes !== 1) failures.push(`expected one #clientes anchor, got ${metrics.uniqueClientes}`);
    if (metrics.legacyAudienceSections !== 0) failures.push(`legacy Público/Clientes sections still rendered: ${metrics.legacyAudienceSections}`);
    if (metrics.eyebrow !== "Clientes & mercados") failures.push(`unexpected Clients eyebrow: ${metrics.eyebrow}`);
    if (metrics.title !== "Da residência ao empreendimento.") failures.push(`unexpected Clients title: ${metrics.title}`);
    if (JSON.stringify(metrics.marketTitles) !== JSON.stringify(MARKET_TITLES)) failures.push(`market order mismatch: ${metrics.marketTitles.join(" | ")}`);
    if (!metrics.marketDescriptionsComplete) failures.push("one or more market descriptions are missing or too short");
    if (JSON.stringify(metrics.referenceNames) !== JSON.stringify(REFERENCE_NAMES)) failures.push(`reference order mismatch: ${metrics.referenceNames.join(" | ")}`);
    if (!metrics.referenceContextsComplete) failures.push("one or more reference contexts are missing");
    if (metrics.referenceImages !== 0) failures.push("reference proof unexpectedly uses logo/image artwork");
    if (metrics.referenceLinks !== 0) failures.push("reference proof unexpectedly exposes promotional links");
    if (metrics.socialLabel !== "Iniciativa social") failures.push(`unexpected social label: ${metrics.socialLabel}`);
    if (metrics.socialTitle !== "Nadando para o Futuro") failures.push(`unexpected social title: ${metrics.socialTitle}`);
    if (!/educa[cç][aã]o/i.test(metrics.socialText) || !/cultura aqu[aá]tica segura/i.test(metrics.socialText)) failures.push("social initiative copy lost its education/safe-aquatic framing");
    if (!metrics.socialSeparated) failures.push("social initiative is not visually/semantically separated from commercial references");
    if (forbiddenClaims.test(metrics.clientsText)) failures.push("Clients/Markets contains an unvalidated quantified or absolute claim");
    if (viewport.width >= 1180 && metrics.gridColumns !== 5) failures.push(`wide market layout expected 5 columns, got ${metrics.gridColumns}`);
    if (viewport.width >= 768 && viewport.width < 1180 && metrics.gridColumns !== 2) failures.push(`tablet market layout expected 2 columns, got ${metrics.gridColumns}`);
    if (viewport.width < 768 && metrics.gridColumns !== 1) failures.push(`phone market layout expected 1 column, got ${metrics.gridColumns}`);
    if (metrics.marketAnimations.some((name) => name !== "none")) failures.push(`market item has unintended animation: ${metrics.marketAnimations.join(", ")}`);
    if (metrics.horizontalOverflow > 1) failures.push(`horizontal overflow ${metrics.horizontalOverflow}px`);
    if (!metrics.sectionInsideViewport) failures.push("Clients/Markets exceeds viewport width");
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
