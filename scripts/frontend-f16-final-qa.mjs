import { once } from "node:events";
import { chromium } from "playwright";
import { createTestSystem } from "../tests/support.js";

const executablePath = process.env.BROWSER_PATH || chromium.executablePath();

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

const sectionSelectors = [
  ".hero",
  "[data-proof-v2]",
  "[data-projects-v2]",
  "[data-services-v2]",
  "[data-why-v2]",
  "[data-process-v2]",
  "[data-clients-v2]",
  "[data-quote-v2]",
  "[data-contact-v2]",
];

const forbiddenVisibleClaims = /(?:desde\s+2006|19\+|mais\s+de\s+19\s+anos|32\+|32\s+piscinas|01\s*\/\s*32|100%|45\s+dias|telefone\s*\/\s*whatsapp)/iu;
const publicAdminPattern = /(?:\badmin\b|\badministrator\b|\bsolima\s+office\b|\blogin\b)/iu;

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
    await page.locator("[data-contact-v2]").waitFor({ state: "attached", timeout: 5_000 });
    await page.locator("[data-sticky-v2]").waitFor({ state: "attached", timeout: 5_000 });
    await page.waitForTimeout(220);

    const metrics = await page.evaluate((selectors) => {
      const sections = selectors.map((selector) => document.querySelector(selector));
      const sectionOrder = sections.map((section) => section?.getBoundingClientRect().top + scrollY ?? -1);
      const idCounts = new Map();
      document.querySelectorAll("[id]").forEach((element) => {
        idCounts.set(element.id, (idCounts.get(element.id) || 0) + 1);
      });
      const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id);

      const brokenInternalAnchors = [...document.querySelectorAll('a[href^="#"]')]
        .map((anchor) => anchor.getAttribute("href"))
        .filter((href) => href && href !== "#" && !document.querySelector(href));

      const visibleText = document.body.innerText.replace(/\s+/g, " ").trim();
      const navFooterText = [
        document.querySelector("#nav")?.innerText || "",
        document.querySelector(".nav-overlay")?.innerText || "",
        document.querySelector("footer")?.innerText || "",
      ].join(" ").replace(/\s+/g, " ").trim();

      const heroQuote = document.querySelector(".hero-quote-cta")?.getBoundingClientRect();
      const sticky = document.querySelector("[data-sticky-v2]");
      const stickyStyle = sticky ? getComputedStyle(sticky) : null;
      const contact = document.querySelector("[data-contact-v2]");
      const footer = document.querySelector("[data-footer-v2]");
      const whatsappLinks = [...(contact?.querySelectorAll('[data-contact-channel="WHATSAPP"]') || [])];
      const email = contact?.querySelector('[data-contact-email-source="OFFICIAL_APPROVED"]');
      const form = document.querySelector("#orcamentoForm");
      const labelsWithoutControl = [...document.querySelectorAll("label[for]")]
        .filter((label) => !document.getElementById(label.htmlFor))
        .map((label) => label.htmlFor);

      return {
        sectionCount: sections.filter(Boolean).length,
        sectionOrder,
        sectionWidths: sections.map((section) => {
          if (!section) return { inside: false, overflow: 999 };
          const rect = section.getBoundingClientRect();
          return {
            inside: rect.left >= -1 && rect.right <= innerWidth + 1,
            overflow: Math.max(0, section.scrollWidth - section.clientWidth),
          };
        }),
        duplicateIds,
        brokenInternalAnchors: [...new Set(brokenInternalAnchors)],
        visibleText,
        navFooterText,
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
        favicon: document.querySelector('link[rel~="icon"]')?.getAttribute("href") || "",
        lang: document.documentElement.lang,
        formCount: document.querySelectorAll("#orcamentoForm").length,
        formExists: Boolean(form),
        leadFields: form ? ["customerName", "phone", "location", "serviceType", "consentGiven"].every((name) => Boolean(form.elements[name])) : false,
        labelsWithoutControl,
        quoteContext: document.querySelector("[data-quote-v2]")?.dataset.quoteContextType || "",
        legacySections: document.querySelectorAll("section.inspiracao, section.lazer, section.visao, section.publico, section.clientes").length,
        projectCount: document.querySelectorAll(".projeto-slide[data-project-slug]").length,
        serviceCount: document.querySelectorAll(".service-v2-card[data-service-type]").length,
        marketCount: document.querySelectorAll(".clients-v2-market").length,
        processStepCount: document.querySelectorAll(".process-v2-step").length,
        whyPillarCount: document.querySelectorAll(".why-v2-pillar").length,
        contactExists: Boolean(contact),
        footerExists: Boolean(footer),
        approvedEmailExists: Boolean(email),
        whatsappCount: whatsappLinks.length,
        publicAdminLinks: [...document.querySelectorAll("a")].filter((anchor) => /(?:\/admin|\/dashboard|\/login)/i.test(anchor.getAttribute("href") || "")).length,
        heroQuoteVisible: Boolean(heroQuote) && heroQuote.width > 0 && heroQuote.height >= 44,
        heroQuoteBottom: heroQuote?.bottom ?? 9999,
        stickyDisplay: stickyStyle?.display || "",
        canvasCount: document.querySelectorAll("canvas").length,
        documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      };
    }, sectionSelectors);

    const failures = [];
    if (metrics.sectionCount !== sectionSelectors.length) failures.push(`primary section count ${metrics.sectionCount}/${sectionSelectors.length}`);
    if (!metrics.sectionOrder.every((value, index, all) => index === 0 || value > all[index - 1])) failures.push(`primary section order invalid: ${metrics.sectionOrder.join(", ")}`);
    metrics.sectionWidths.forEach((entry, index) => {
      if (!entry.inside) failures.push(`section outside viewport: ${sectionSelectors[index]}`);
      if (entry.overflow > 1) failures.push(`section overflow ${entry.overflow}px: ${sectionSelectors[index]}`);
    });
    if (metrics.duplicateIds.length) failures.push(`duplicate ids: ${metrics.duplicateIds.join(", ")}`);
    if (metrics.brokenInternalAnchors.length) failures.push(`broken internal anchors: ${metrics.brokenInternalAnchors.join(", ")}`);
    if (forbiddenVisibleClaims.test(metrics.visibleText)) failures.push("legacy quantified/WhatsApp-assumption claim remains visible");
    if (publicAdminPattern.test(metrics.navFooterText) || metrics.publicAdminLinks) failures.push("public navigation/footer exposes Admin/Login surface");
    if (!/^pt(?:-|$)/i.test(metrics.lang)) failures.push(`unexpected document language: ${metrics.lang}`);
    if (!/SOLIMA/i.test(metrics.title) || /19\+|19 anos|2006/i.test(metrics.title)) failures.push(`unsafe title: ${metrics.title}`);
    if (!/Construção, modernização e manutenção de piscinas/i.test(metrics.description) || /19\+|19 anos|2006/i.test(metrics.description)) failures.push(`unsafe meta description: ${metrics.description}`);
    if (metrics.favicon !== "/assets/brand/solima-favicon.svg") failures.push(`unexpected favicon: ${metrics.favicon}`);
    if (metrics.formCount !== 1 || !metrics.formExists || !metrics.leadFields) failures.push("lead form contract/single-form invariant failed");
    if (metrics.labelsWithoutControl.length) failures.push(`labels without controls: ${metrics.labelsWithoutControl.join(", ")}`);
    if (metrics.quoteContext !== "GENERIC") failures.push(`quote initial context should be GENERIC, got ${metrics.quoteContext}`);
    if (metrics.legacySections !== 0) failures.push(`legacy story/audience sections still rendered: ${metrics.legacySections}`);
    if (metrics.projectCount !== 6) failures.push(`project count ${metrics.projectCount}/6`);
    if (metrics.serviceCount !== 3) failures.push(`service count ${metrics.serviceCount}/3`);
    if (metrics.marketCount !== 5) failures.push(`market count ${metrics.marketCount}/5`);
    if (metrics.processStepCount !== 6) failures.push(`process step count ${metrics.processStepCount}/6`);
    if (metrics.whyPillarCount !== 5) failures.push(`Why SOLIMA pillar count ${metrics.whyPillarCount}/5`);
    if (!metrics.contactExists || !metrics.footerExists) failures.push("contact/footer v2 missing");
    if (!metrics.approvedEmailExists) failures.push("approved public email marker missing");
    if (metrics.whatsappCount > 1) failures.push(`more than one public WhatsApp contact exposed: ${metrics.whatsappCount}`);
    if (!metrics.heroQuoteVisible) failures.push("primary Hero quote CTA missing or below 44px");
    if (viewport.kind === "phone" && viewport.height <= 680 && metrics.heroQuoteBottom > viewport.height + 1) failures.push(`compact Hero CTA below fold: ${metrics.heroQuoteBottom}px`);
    if (viewport.width >= 768 && metrics.stickyDisplay !== "none") failures.push("mobile sticky visible on tablet/desktop");
    if (metrics.canvasCount !== 0) failures.push(`unexpected canvas/WebGL surfaces: ${metrics.canvasCount}`);
    if (metrics.documentOverflow > 1) failures.push(`document horizontal overflow: ${metrics.documentOverflow}px`);
    if (consoleErrors.length) failures.push(`console errors: ${consoleErrors.join(" | ")}`);

    results.push({ ...viewport, failures, passed: failures.length === 0 });
    await context.close();
  }

  // Final functional smoke: every major commercial entry point must open the
  // same hardened form and preserve its context without creating duplicate forms.
  const smokeContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await smokeContext.addInitScript(() => {
    try {
      Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } });
    } catch {}
    Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value() { return Promise.resolve(); } });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value() {} });
    Object.defineProperty(HTMLMediaElement.prototype, "load", { configurable: true, value() {} });
  });
  const smokePage = await smokeContext.newPage();
  const smokeErrors = [];
  smokePage.on("pageerror", (error) => smokeErrors.push(error.message));
  await smokePage.goto(baseURL, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await smokePage.locator("[data-quote-v2]").waitFor({ state: "attached", timeout: 5_000 });

  const smokeCases = [
    [".hero-quote-cta", "GENERIC"],
    ['.project-v2-quote-cta[data-project-ref="vista-do-vale"]', "PROJECT"],
    ['.service-v2-quote-cta[data-service-type="NEW_CONSTRUCTION"]', "SERVICE"],
    [".process-v2-cta", "PROCESS"],
    [".contact-v2-quote-cta", "GENERIC"],
  ];
  const smokeFailures = [];
  for (const [selector, expectedContext] of smokeCases) {
    await smokePage.locator(selector).first().click();
    await smokePage.waitForTimeout(50);
    const state = await smokePage.evaluate(() => ({
      open: document.querySelector("[data-quote-v2]")?.classList.contains("quote-v2-task-open"),
      context: document.querySelector("[data-quote-v2]")?.dataset.quoteContextType || "",
      forms: document.querySelectorAll("#orcamentoForm").length,
    }));
    if (!state.open || state.context !== expectedContext || state.forms !== 1) {
      smokeFailures.push(`${selector}: open=${state.open} context=${state.context} forms=${state.forms}`);
    }
    await smokePage.keyboard.press("Escape");
    await smokePage.waitForTimeout(40);
  }
  if (smokeErrors.length) smokeFailures.push(`page errors: ${smokeErrors.join(" | ")}`);
  results.push({ name: "commercial-entry-smoke", kind: "functional", failures: smokeFailures, passed: smokeFailures.length === 0 });
  await smokeContext.close();

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
