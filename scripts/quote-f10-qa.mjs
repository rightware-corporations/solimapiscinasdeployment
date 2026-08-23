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
  { name: "844x390", width: 844, height: 390, kind: "tablet" },
  { name: "1024x768", width: 1024, height: 768, kind: "tablet" },
  { name: "1366x768", width: 1366, height: 768, kind: "desktop" },
  { name: "1440x900", width: 1440, height: 900, kind: "desktop" },
  { name: "1920x1080", width: 1920, height: 1080, kind: "desktop" },
];

const executablePath = process.env.BROWSER_PATH || chromium.executablePath();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function preparePage(context, baseURL) {
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
  await page.locator("[data-quote-v2]").waitFor({ state: "attached", timeout: 5_000 });
  await page.waitForTimeout(160);
  return { page, consoleErrors };
}

async function quoteMetrics(page) {
  return page.evaluate(() => {
    const section = document.querySelector("[data-quote-v2]");
    const card = section.querySelector(".orcamento-form-card");
    const grid = section.querySelector(".orcamento-grid");
    const close = card.querySelector(".quote-v2-task-close");
    const banner = card.querySelector(".quote-v2-context");
    const backdrop = section.querySelector(".quote-v2-backdrop");
    const panelRect = grid.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();
    const checkedService = card.querySelector('input[name="serviceType"]:checked')?.value || "";

    return {
      styleLoaded: Boolean(document.querySelector('link[data-solima-quote-v2]')),
      formCount: document.querySelectorAll("#orcamentoForm").length,
      title: section.querySelector("#quoteV2Title")?.textContent?.replace(/\s+/g, " ").trim() || "",
      phoneLabel: section.querySelector('label[for="phone"]')?.textContent?.trim() || "",
      contextType: section.dataset.quoteContextType || "",
      contextRef: section.dataset.quoteContextRef || "",
      suggestedService: section.dataset.quoteSuggestedService || "",
      checkedService,
      bannerHidden: banner.hidden,
      contextEyebrow: banner.querySelector(".quote-v2-context-eyebrow")?.textContent?.trim() || "",
      contextTitle: banner.querySelector(".quote-v2-context-title")?.textContent?.trim() || "",
      contextDetail: banner.querySelector(".quote-v2-context-detail")?.textContent?.trim() || "",
      taskOpen: section.classList.contains("quote-v2-task-open"),
      role: section.getAttribute("role") || "",
      ariaModal: section.getAttribute("aria-modal") || "",
      bodyOpen: document.body.classList.contains("quote-v2-open"),
      backdropTag: backdrop.tagName,
      backdropTabIndex: backdrop.tabIndex,
      closeVisible: !close.hidden && closeRect.width > 0 && closeRect.height > 0,
      closeWidth: closeRect.width,
      closeHeight: closeRect.height,
      activeIsClose: document.activeElement === close,
      panelWidth: panelRect.width,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      inertedCount: document.querySelectorAll("[data-quote-v2-inerted]").length,
      placeholderCount: document.querySelectorAll(".quote-v2-placeholder").length,
    };
  });
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
    const { page, consoleErrors } = await preparePage(context, baseURL);
    const failures = [];

    const initial = await quoteMetrics(page);
    if (!initial.styleLoaded) failures.push("Quote v2 stylesheet not loaded");
    if (initial.formCount !== 1) failures.push(`expected one lead form, got ${initial.formCount}`);
    if (initial.title !== "Conte-nos o que precisa.") failures.push(`unexpected quote title: ${initial.title}`);
    if (initial.phoneLabel !== "Telefone *") failures.push(`phone label still implies WhatsApp: ${initial.phoneLabel}`);
    if (initial.contextType !== "GENERIC" || !initial.bannerHidden) failures.push("inline quote did not start in calm generic mode");
    if (initial.taskOpen || initial.bodyOpen) failures.push("quote task unexpectedly open on initial load");
    if (initial.backdropTag !== "DIV" || initial.backdropTabIndex >= 0) failures.push("backdrop is incorrectly keyboard-focusable");

    const serviceCta = page.locator('.service-v2-quote-cta[data-service-type="NEW_CONSTRUCTION"]').first();
    await serviceCta.click();
    await page.waitForTimeout(70);
    const service = await quoteMetrics(page);
    if (!service.taskOpen || service.role !== "dialog" || service.ariaModal !== "true" || !service.bodyOpen) failures.push("service CTA did not open modal task semantics");
    if (service.contextType !== "SERVICE" || service.suggestedService !== "NEW_CONSTRUCTION") failures.push("service context/suggestion missing");
    if (service.checkedService !== "NEW_CONSTRUCTION") failures.push(`service was not preselected: ${service.checkedService || "none"}`);
    if (service.bannerHidden || service.contextTitle !== "Construção") failures.push(`service context banner incorrect: ${service.contextTitle}`);
    if (!service.closeVisible || service.closeWidth < 44 || service.closeHeight < 44) failures.push(`close target below 44px: ${service.closeWidth}x${service.closeHeight}`);
    if (!service.activeIsClose) failures.push("focus did not move to task close control");
    if (service.inertedCount < 1 || service.placeholderCount !== 1) failures.push("background isolation/scroll placeholder not active");
    if (viewport.kind === "phone" && service.panelWidth < viewport.width * 0.94) failures.push(`phone task is not near-full-width: ${service.panelWidth}px`);
    if (viewport.kind === "tablet" && service.panelWidth >= viewport.width) failures.push(`tablet task should remain a sheet: ${service.panelWidth}px`);
    if (viewport.kind === "desktop" && service.panelWidth > 660) failures.push(`desktop drawer too wide: ${service.panelWidth}px`);
    if (service.horizontalOverflow > 1) failures.push(`task horizontal overflow ${service.horizontalOverflow}px`);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(60);
    const serviceClosed = await quoteMetrics(page);
    const serviceFocusRestored = await serviceCta.evaluate((element) => document.activeElement === element);
    if (serviceClosed.taskOpen || serviceClosed.bodyOpen || serviceClosed.placeholderCount !== 0 || serviceClosed.inertedCount !== 0) failures.push("Escape did not fully restore inline page state");
    if (!serviceFocusRestored) failures.push("Escape did not restore focus to service CTA");

    const projectOne = page.locator('.project-v2-quote-cta[data-project-ref="vista-do-vale"]').first();
    await projectOne.click();
    await page.waitForTimeout(60);
    const project = await quoteMetrics(page);
    if (project.contextType !== "PROJECT" || project.contextRef !== "vista-do-vale") failures.push("project reference context missing");
    if (project.suggestedService !== "NEW_CONSTRUCTION" || project.checkedService !== "NEW_CONSTRUCTION") failures.push("project suggested service was not applied");
    if (project.contextTitle !== "Vista do Vale" || project.bannerHidden) failures.push(`project banner incorrect: ${project.contextTitle}`);
    await page.keyboard.press("Escape");

    const projectWithoutSuggestion = page.locator('.project-v2-quote-cta[data-project-ref="conjunto-familiar"]').first();
    await projectWithoutSuggestion.click();
    await page.waitForTimeout(60);
    const noSuggestion = await quoteMetrics(page);
    if (noSuggestion.contextRef !== "conjunto-familiar" || noSuggestion.suggestedService) failures.push("project without known service gained an invented suggestion");
    if (noSuggestion.checkedService) failures.push(`stale auto-service leaked into unsuggested project: ${noSuggestion.checkedService}`);
    if (!/escolhido por si/i.test(noSuggestion.contextDetail)) failures.push("unsuggested project copy does not preserve customer choice");
    await page.keyboard.press("Escape");

    const processCta = page.locator(".process-v2-cta").first();
    await processCta.click();
    await page.waitForTimeout(60);
    const process = await quoteMetrics(page);
    if (process.contextType !== "PROCESS" || process.bannerHidden) failures.push("process CTA did not preserve process context");
    if (process.contextTitle !== "Começar pelo seu projeto") failures.push(`unexpected process context title: ${process.contextTitle}`);
    await page.keyboard.press("Escape");

    const heroCta = page.locator(".hero-quote-cta").first();
    await heroCta.click();
    await page.waitForTimeout(60);
    const generic = await quoteMetrics(page);
    if (!generic.taskOpen || generic.contextType !== "GENERIC" || !generic.bannerHidden) failures.push("generic Hero CTA did not open the same form in generic mode");
    await page.keyboard.press("Escape");

    if (consoleErrors.length) failures.push(`console errors: ${consoleErrors.join(" | ")}`);
    results.push({ ...viewport, failures, passed: failures.length === 0 });
    await context.close();
  }

  // One end-to-end browser contract check: the contextual UI must still submit
  // the original multipart lead payload with the existing Idempotency-Key and
  // must not smuggle future LeadIntent fields into the current backend contract.
  const submitContext = await browser.newContext(contextOptions({ width: 390, height: 844, kind: "phone" }));
  const { page: submitPage, consoleErrors: submitConsoleErrors } = await preparePage(submitContext, baseURL);
  let captured = null;
  await submitPage.route("**/api/leads", async (route) => {
    const request = route.request();
    captured = {
      headers: request.headers(),
      body: request.postData() || "",
    };
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: "f10-synthetic-lead" }),
    });
  });

  await submitPage.locator(".hero-quote-cta").click();
  await submitPage.locator("#customerName").fill("Teste F10 SOLIMA");
  await submitPage.locator("#phone").fill("+258 82 000 0000");
  await submitPage.locator("#location").fill("Maputo");
  await submitPage.locator(".form-next").click();
  await submitPage.locator('label.choice-card:has(input[name="serviceType"][value="MAINTENANCE"])').click();
  await submitPage.locator(".form-next").click();
  await submitPage.locator('input[name="consentGiven"]').check();
  await submitPage.locator(".form-submit").click();
  await submitPage.locator(".success-dialog[open]").waitFor({ state: "attached", timeout: 5_000 });

  const submitFailures = [];
  if (!captured) {
    submitFailures.push("lead POST was not captured");
  } else {
    const idempotencyKey = captured.headers["idempotency-key"] || "";
    if (!uuidPattern.test(idempotencyKey)) submitFailures.push(`invalid/missing Idempotency-Key: ${idempotencyKey}`);
    for (const field of ["customerName", "phone", "location", "serviceType", "extras", "consentGiven", "startedAt"]) {
      if (!captured.body.includes(`name=\"${field}\"`) && !captured.body.includes(`name="${field}"`)) {
        submitFailures.push(`multipart field missing: ${field}`);
      }
    }
    if (!captured.body.includes("MAINTENANCE")) submitFailures.push("selected service missing from multipart body");
    for (const futureField of ["intentContext", "sourceType", "sourceRef", "projectRef", "suggestedService"]) {
      if (captured.body.includes(`name=\"${futureField}\"`) || captured.body.includes(`name="${futureField}"`)) {
        submitFailures.push(`future backend field leaked into current contract: ${futureField}`);
      }
    }
  }

  await submitPage.locator(".close-dialog").click();
  await submitPage.waitForTimeout(80);
  const afterSuccess = await quoteMetrics(submitPage);
  if (afterSuccess.taskOpen || afterSuccess.bodyOpen) submitFailures.push("successful lead dialog did not return the page to inline state");
  if (submitConsoleErrors.length) submitFailures.push(`submit console errors: ${submitConsoleErrors.join(" | ")}`);
  results.push({ name: "multipart-contract", width: 390, height: 844, kind: "functional", failures: submitFailures, passed: submitFailures.length === 0 });
  await submitContext.close();

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
