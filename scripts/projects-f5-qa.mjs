import { once } from "node:events";
import { chromium } from "playwright";
import { createTestSystem } from "../tests/support.js";

const PROJECTS = [
  { index: 1, title: "Vista do Vale", slug: "vista-do-vale", theme: "NATURE_ENGINEERING", service: "NEW_CONSTRUCTION", taxonomyItems: 2 },
  { index: 2, title: "Residência Sommerschield", slug: "residencia-sommerschield", theme: "TRANSFORMATION_TECHNOLOGY", service: "MODERNIZATION", taxonomyItems: 2 },
  { index: 3, title: "Composite Deck", slug: "composite-deck", theme: "DESIGN_COMPACT", service: "NEW_CONSTRUCTION", taxonomyItems: 2 },
  { index: 4, title: "Crepúsculo Aquático", slug: "crepusculo-aquatico", theme: "ATMOSPHERE_LIGHTING", service: "MODERNIZATION", taxonomyItems: 2 },
  { index: 5, title: "Conjunto Familiar", slug: "conjunto-familiar", theme: "FAMILY_SAFETY", service: null, taxonomyItems: 1 },
  { index: 6, title: "Pergola & Lounge", slug: "pergola-lounge", theme: "LIFESTYLE", service: null, taxonomyItems: 1 },
];

const viewports = [
  { name: "320x568", width: 320, height: 568, kind: "phone" },
  { name: "360x640", width: 360, height: 640, kind: "phone" },
  { name: "375x667", width: 375, height: 667, kind: "phone" },
  { name: "390x844", width: 390, height: 844, kind: "phone" },
  { name: "414x896", width: 414, height: 896, kind: "phone" },
  { name: "844x390", width: 844, height: 390, kind: "tablet" },
  { name: "768x1024", width: 768, height: 1024, kind: "tablet" },
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
      // F5 does not exercise Hero media. Save-Data keeps the test deterministic
      // and prevents external Pexels video transfer from affecting project QA.
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
    await page.locator("[data-projects-v2]").waitFor({ state: "attached", timeout: 5_000 });
    await page.locator(".project-v2-quote-cta").first().waitFor({ state: "attached", timeout: 5_000 });
    await page.waitForTimeout(160);

    const metrics = await page.evaluate(({ expectedProjects, width }) => {
      const proof = document.querySelector("[data-proof-v2]");
      const section = document.querySelector("[data-projects-v2]");
      const slides = [...section.querySelectorAll(".projeto-slide")];
      const sectionRect = section.getBoundingClientRect();
      const firstSlide = slides[0];
      const firstImageRect = firstSlide?.querySelector(".projeto-image-wrap")?.getBoundingClientRect();
      const firstContentRect = firstSlide?.querySelector(".projeto-content")?.getBoundingClientRect();
      const firstSlideRect = firstSlide?.getBoundingClientRect();
      const ctaRects = slides.map((slide) => slide.querySelector(".project-v2-quote-cta")?.getBoundingClientRect());

      const projectData = slides.map((slide, index) => {
        const expected = expectedProjects[index];
        const cta = slide.querySelector(".project-v2-quote-cta");
        const title = slide.querySelector(".projeto-title")?.textContent?.trim() || "";
        const category = slide.querySelector(".projeto-category")?.textContent?.trim() || "";
        const taxonomyItems = [...slide.querySelectorAll(".project-v2-taxonomy-item")];
        const taxonomyKeys = [...slide.querySelectorAll(".project-v2-taxonomy-key")]
          .map((node) => node.textContent?.trim() || "");
        return {
          index: index + 1,
          title,
          slug: slide.dataset.projectSlug || "",
          theme: slide.dataset.projectTheme || "",
          service: slide.dataset.serviceCategory || null,
          category,
          taxonomyItems: taxonomyItems.length,
          taxonomyKeys,
          ctaLabel: cta?.querySelector("span:first-child")?.textContent?.trim() || "",
          ctaArrow: cta?.querySelector(".project-v2-quote-arrow")?.textContent?.trim() || "",
          ctaHref: cta?.getAttribute("href") || "",
          intentAction: cta?.dataset.intentAction || "",
          intentSource: cta?.dataset.intentSource || "",
          projectRef: cta?.dataset.projectRef || "",
          projectName: cta?.dataset.projectName || "",
          projectTheme: cta?.dataset.projectTheme || "",
          suggestedService: cta?.dataset.suggestedService || null,
          serviceIsIntentionallyUnset: expected.service === null
            ? !slide.hasAttribute("data-service-category") && !cta?.hasAttribute("data-suggested-service")
            : true,
        };
      });

      const slidesInsideViewport = slides.every((slide) => {
        const rect = slide.getBoundingClientRect();
        return rect.left >= -1 && rect.right <= innerWidth + 1;
      });

      const minCtaHeight = Math.min(...ctaRects.filter(Boolean).map((rect) => rect.height));
      const phoneLeftAligned = width > 767 || getComputedStyle(firstSlide.querySelector(".projeto-content")).textAlign === "left";
      const stackedEditorial = width >= 900 || !firstImageRect || !firstContentRect
        ? true
        : firstContentRect.top >= firstImageRect.bottom - 2;
      const landscapeSplit = width < 900 || width >= 1180 || !firstImageRect || !firstContentRect
        ? true
        : firstImageRect.right <= firstContentRect.left + 2 && firstImageRect.width > 0 && firstContentRect.width > 0;
      const desktopCinema = width < 1180 || !firstSlideRect
        ? true
        : firstSlideRect.height >= innerHeight * .95;
      const desktopRail = width < 1180
        ? true
        : getComputedStyle(document.querySelector("#projetosRail")).display !== "none";

      return {
        styleLoaded: Boolean(document.querySelector('link[data-solima-projects-v2]')),
        immediatelyAfterProof: proof?.nextElementSibling === section,
        introEyebrow: section.querySelector(".projetos-intro .eyebrow")?.textContent?.trim() || "",
        introTitle: section.querySelector(".projetos-intro-title")?.innerText?.replace(/\s+/g, " ").trim() || "",
        slideCount: slides.length,
        ctaCount: section.querySelectorAll(".project-v2-quote-cta").length,
        horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
        sectionInsideViewport: sectionRect.left >= -1 && sectionRect.right <= innerWidth + 1,
        slidesInsideViewport,
        minCtaHeight,
        phoneLeftAligned,
        stackedEditorial,
        landscapeSplit,
        desktopCinema,
        desktopRail,
        projectData,
      };
    }, { expectedProjects: PROJECTS, width: viewport.width });

    const failures = [];
    if (!metrics.styleLoaded) failures.push("projects stylesheet not loaded");
    if (!metrics.immediatelyAfterProof) failures.push("Projects is not immediately after Proof");
    if (metrics.introEyebrow !== "Projetos SOLIMA") failures.push(`unexpected projects eyebrow: ${metrics.introEyebrow}`);
    if (!metrics.introTitle.includes("Inspire-se em soluções construídas.")) failures.push(`unexpected projects title: ${metrics.introTitle}`);
    if (metrics.slideCount !== PROJECTS.length) failures.push(`expected ${PROJECTS.length} project slides, got ${metrics.slideCount}`);
    if (metrics.ctaCount !== PROJECTS.length) failures.push(`expected ${PROJECTS.length} project CTAs, got ${metrics.ctaCount}`);
    if (metrics.horizontalOverflow > 1) failures.push(`horizontal overflow ${metrics.horizontalOverflow}px`);
    if (!metrics.sectionInsideViewport) failures.push("projects section exceeds viewport width");
    if (!metrics.slidesInsideViewport) failures.push("one or more project slides exceed viewport width");
    if (viewport.width <= 767 && metrics.minCtaHeight < 44) failures.push(`mobile CTA touch target is ${metrics.minCtaHeight}px`);
    if (!metrics.phoneLeftAligned) failures.push("mobile project copy is not editorial left-aligned");
    if (!metrics.stackedEditorial) failures.push("sub-900 project composition is not image-then-copy stacked");
    if (!metrics.landscapeSplit) failures.push("900-1179 project composition is not split image/copy");
    if (!metrics.desktopCinema) failures.push("desktop project slide no longer preserves full-screen cinema");
    if (!metrics.desktopRail) failures.push("desktop project rail is not available");

    metrics.projectData.forEach((actual, index) => {
      const expected = PROJECTS[index];
      if (actual.title !== expected.title) failures.push(`project ${expected.index} title changed: ${actual.title}`);
      if (actual.slug !== expected.slug) failures.push(`project ${expected.index} slug mismatch: ${actual.slug}`);
      if (actual.theme !== expected.theme) failures.push(`project ${expected.index} theme mismatch: ${actual.theme}`);
      if (actual.service !== expected.service) failures.push(`project ${expected.index} service mismatch: ${actual.service}`);
      if (actual.taxonomyItems !== expected.taxonomyItems) failures.push(`project ${expected.index} expected ${expected.taxonomyItems} taxonomy items, got ${actual.taxonomyItems}`);
      if (!actual.taxonomyKeys.includes("Tema")) failures.push(`project ${expected.index} has no theme taxonomy`);
      if (expected.service && !actual.taxonomyKeys.includes("Serviço")) failures.push(`project ${expected.index} has no service taxonomy`);
      if (!expected.service && /Famílias|Lazer/.test(actual.category)) failures.push(`project ${expected.index} still mixes theme into service category: ${actual.category}`);
      if (actual.ctaLabel !== "Quero algo como isto" || actual.ctaArrow !== "↗") failures.push(`project ${expected.index} CTA semantic copy mismatch: ${actual.ctaLabel} ${actual.ctaArrow}`);
      if (actual.ctaHref !== "#orcamento") failures.push(`project ${expected.index} CTA does not target quote section`);
      if (actual.intentAction !== "QUOTE" || actual.intentSource !== "PROJECT") failures.push(`project ${expected.index} CTA intent metadata is incomplete`);
      if (actual.projectRef !== expected.slug || actual.projectName !== expected.title || actual.projectTheme !== expected.theme) failures.push(`project ${expected.index} CTA project context mismatch`);
      if (actual.suggestedService !== expected.service) failures.push(`project ${expected.index} suggested service mismatch: ${actual.suggestedService}`);
      if (!actual.serviceIsIntentionallyUnset) failures.push(`project ${expected.index} invented a service classification`);
    });

    if (consoleErrors.length) failures.push(`console errors: ${consoleErrors.join(" | ")}`);

    results.push({ ...viewport, ...metrics, projectData: undefined, consoleErrors, failures, passed: failures.length === 0 });
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
