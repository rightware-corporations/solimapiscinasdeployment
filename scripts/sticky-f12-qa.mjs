import { once } from "node:events";
import { chromium } from "playwright";
import { createTestSystem } from "../tests/support.js";

const viewports = [
  { name: "320x568", width: 320, height: 568, phone: true },
  { name: "360x640", width: 360, height: 640, phone: true },
  { name: "390x844", width: 390, height: 844, phone: true },
  { name: "414x896", width: 414, height: 896, phone: true },
  { name: "768x1024", width: 768, height: 1024, phone: false },
  { name: "1024x768", width: 1024, height: 768, phone: false },
];

const executablePath = process.env.BROWSER_PATH || chromium.executablePath();
let system;
let server;
let browser;
const results = [];

const contextOptions = (viewport) => ({
  viewport: { width: viewport.width, height: viewport.height },
  deviceScaleFactor: viewport.phone ? 2 : 1.5,
  isMobile: viewport.phone,
  hasTouch: true,
});

async function settle(page, delay = 180) {
  await page.waitForTimeout(delay);
}

async function scrollTo(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await settle(page, 220);
}

async function stickyMetrics(page) {
  return page.evaluate(() => {
    const sticky = document.querySelector("[data-sticky-v2]");
    const cta = sticky?.querySelector(".sticky-v2-cta");
    const rect = cta?.getBoundingClientRect();
    const style = sticky ? getComputedStyle(sticky) : null;
    return {
      exists: Boolean(sticky),
      styleLoaded: Boolean(document.querySelector('link[data-solima-sticky-v2]')),
      ready: document.documentElement.dataset.stickyV2Ready === "true",
      visible: Boolean(sticky) && !sticky.hidden && style?.display !== "none" && (rect?.height || 0) > 0,
      hiddenAttribute: sticky?.hidden ?? true,
      context: sticky?.dataset.stickyContext || "",
      ref: sticky?.dataset.stickyRef || "",
      label: sticky?.querySelector(".sticky-v2-label")?.textContent?.replace(/\s+/g, " ").trim() || "",
      source: cta?.dataset.intentSource || "",
      placement: cta?.dataset.intentPlacement || "",
      projectRef: cta?.dataset.projectRef || "",
      serviceType: cta?.dataset.serviceType || "",
      suggestedService: cta?.dataset.suggestedService || "",
      touchTarget: Boolean(rect) && rect.width >= 44 && rect.height >= 44,
      insideViewport: Boolean(rect) && rect.left >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1,
      bottomGap: rect ? innerHeight - rect.bottom : null,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      focused: document.activeElement === cta,
    };
  });
}

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
    await settle(page, 220);

    const failures = [];
    const initial = await stickyMetrics(page);
    if (!initial.exists || !initial.styleLoaded || !initial.ready) failures.push("sticky foundation not initialized");
    if (initial.visible) failures.push("sticky should be hidden in Hero");
    if (initial.horizontalOverflow > 1) failures.push(`initial horizontal overflow ${initial.horizontalOverflow}px`);

    await scrollTo(page, "#projetos .projeto-slide[data-project='1']");
    const project = await stickyMetrics(page);

    if (viewport.phone) {
      if (!project.visible) failures.push("project sticky is not visible on phone");
      if (project.context !== "PROJECT") failures.push(`project context mismatch: ${project.context}`);
      if (project.projectRef !== "vista-do-vale" || project.ref !== "vista-do-vale") failures.push(`project ref mismatch: ${project.projectRef}/${project.ref}`);
      if (project.source !== "PROJECT" || project.placement !== "STICKY") failures.push(`project intent source/placement mismatch: ${project.source}/${project.placement}`);
      if (project.label !== "Quero algo como isto") failures.push(`project label mismatch: ${project.label}`);
      if (project.suggestedService !== "NEW_CONSTRUCTION") failures.push(`project suggestion mismatch: ${project.suggestedService}`);
      if (!project.touchTarget || !project.insideViewport) failures.push("project sticky touch target/viewport containment failed");

      await page.locator(".sticky-v2-cta").click();
      await page.locator("#orcamento.quote-v2-task-open").waitFor({ state: "attached", timeout: 3_000 });
      await settle(page, 80);
      const openState = await page.evaluate(() => ({
        quoteContext: document.querySelector("#orcamento")?.dataset.quoteContextType || "",
        quoteRef: document.querySelector("#orcamento")?.dataset.quoteContextRef || "",
        stickyDisplay: getComputedStyle(document.querySelector("[data-sticky-v2]")).display,
        bodyOpen: document.body.classList.contains("quote-v2-open"),
      }));
      if (!openState.bodyOpen || openState.quoteContext !== "PROJECT" || openState.quoteRef !== "vista-do-vale") failures.push(`sticky did not open project quote context: ${JSON.stringify(openState)}`);
      if (openState.stickyDisplay !== "none") failures.push("sticky remains visible while quote task is open");

      await page.keyboard.press("Escape");
      await settle(page, 140);
      const afterClose = await stickyMetrics(page);
      if (!afterClose.visible) failures.push("sticky did not return after closing quote task");
      if (!afterClose.focused) failures.push("focus did not return to sticky CTA after closing quote task");

      await scrollTo(page, '#servicos .service-v2-card[data-service-type="MODERNIZATION"]');
      const service = await stickyMetrics(page);
      if (!service.visible || service.context !== "SERVICE") failures.push(`service sticky missing/context mismatch: ${service.context}`);
      if (service.serviceType !== "MODERNIZATION" || service.ref !== "MODERNIZATION") failures.push(`service ref mismatch: ${service.serviceType}/${service.ref}`);
      if (service.source !== "SERVICE" || service.placement !== "STICKY") failures.push(`service intent source/placement mismatch: ${service.source}/${service.placement}`);
      if (service.label !== "Quero modernizar a minha piscina") failures.push(`service label mismatch: ${service.label}`);

      await scrollTo(page, "#sobre[data-why-v2]");
      const generic = await stickyMetrics(page);
      if (!generic.visible || generic.context !== "GENERIC") failures.push(`generic sticky missing/context mismatch: ${generic.context}`);
      if (generic.label !== "Pedir orçamento" || generic.source !== "STICKY") failures.push(`generic intent mismatch: ${generic.label}/${generic.source}`);

      await scrollTo(page, "#orcamento");
      const quote = await stickyMetrics(page);
      if (quote.visible) failures.push("sticky should be hidden in inline Quote section");

      await scrollTo(page, "#contacto");
      const contact = await stickyMetrics(page);
      if (contact.visible) failures.push("sticky should be hidden in Contact section");
    } else {
      if (project.visible) failures.push("sticky should never render visibly at tablet/desktop width");
    }

    const finalMetrics = await stickyMetrics(page);
    if (finalMetrics.horizontalOverflow > 1) failures.push(`final horizontal overflow ${finalMetrics.horizontalOverflow}px`);
    if (consoleErrors.length) failures.push(`console errors: ${consoleErrors.join(" | ")}`);

    results.push({ ...viewport, passed: failures.length === 0, failures });
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
