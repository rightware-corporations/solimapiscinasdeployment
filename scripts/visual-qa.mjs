import fs from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import { chromium } from "playwright";
import { createTestSystem } from "../tests/support.js";

process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = "1";

const managedServer = !process.env.BASE_URL;
let baseURL = process.env.BASE_URL;
const executablePath = process.env.BROWSER_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const motionArg = process.argv.find((arg) => arg.startsWith("--motion="));
const motion = motionArg?.split("=")[1] === "normal" ? "normal" : "reduced";
const offsetArg = process.argv.find((arg) => arg.startsWith("--offset="));
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const offset = Number(offsetArg?.split("=")[1] ?? 0);
const limit = Number(limitArg?.split("=")[1] ?? 15);

const allViewports = [
  [320,568],[360,800],[390,844],[430,932],[844,390],[768,1024],[820,1180],[1024,768],
  [1180,820],[1280,720],[1366,768],[1440,900],[1536,864],[1646,928],[1920,1080]
].map(([width, height]) => ({ name: `${width}x${height}`, width, height }));
const viewports = allViewports.slice(offset, offset + limit);
const requiredScreenshots = new Set(["320x568", "390x844", "844x390", "1180x820", "1440x900", "1920x1080"]);
const formStateScreenshots = new Set(["390x844", "1440x900"]);

const reportRoot = path.resolve(process.env.VISUAL_REPORT_ROOT || "visual-report-v2.1");
const modeRoot = path.join(reportRoot, motion);
await fs.mkdir(modeRoot, { recursive: true });

let server;
let testSystem;
let browser;
const results = [];
const bounded = (promise, ms) => Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))]);

function contextOptions(viewport) {
  const phone = viewport.width <= 430 || viewport.name === "844x390";
  const tablet = !phone && viewport.width >= 768 && viewport.width <= 1024;
  const mobileUA = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
  const tabletUA = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
  return {
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: phone ? 2 : tablet ? 1.5 : 1,
    isMobile: phone,
    hasTouch: phone || tablet,
    userAgent: phone ? mobileUA : tablet ? tabletUA : undefined,
    reducedMotion: motion === "reduced" ? "reduce" : "no-preference"
  };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(`${baseURL}/health`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Servidor de QA indisponível em ${baseURL}`);
}

async function settle(page, delay = 260) {
  await page.waitForTimeout(motion === "reduced" ? Math.min(delay, 100) : delay);
}

async function scrollToSection(page, selector) {
  await page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    if (!target) throw new Error(`Secção ausente: ${targetSelector}`);
    const navHeight = document.querySelector("#nav")?.getBoundingClientRect().height || 0;
    const destination = target.getBoundingClientRect().top + scrollY - navHeight - 12;
    if (window.solimaLenis) window.solimaLenis.scrollTo(destination, { immediate: true, force: true });
    else window.scrollTo({ top: destination, behavior: "instant" });
  }, selector);
  await settle(page, 420);
}

async function screenshotViewport(page, viewport, label) {
  if (!requiredScreenshots.has(viewport.name)) return;
  const directory = path.join(modeRoot, viewport.name);
  await fs.mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${label}.png`), fullPage: false, animations: "disabled" });
}

async function openStepThree(page, viewport) {
  await page.locator("#customerName").fill("QA Visual SOLIMA");
  await page.locator("#phone").fill("824407120");
  await page.locator("#location").fill("Maputo");
  await page.locator(".form-next").click();
  await settle(page);
  if (formStateScreenshots.has(viewport.name)) await screenshotViewport(page, viewport, "form-step2");
  await page.locator(".choice-grid.services .choice-card").first().click();
  await page.locator('[name="serviceType"]').first().waitFor({ state: "attached" });
  await page.locator(".form-next").click();
  await settle(page);
  if (formStateScreenshots.has(viewport.name)) await screenshotViewport(page, viewport, "form-step3");
}

async function captureSuccessAndClose(page, viewport) {
  if (!formStateScreenshots.has(viewport.name)) return true;
  await page.locator(".consent-control").click();
  await page.waitForTimeout(1900);
  await page.locator(".form-submit").click();
  const dialog = page.locator(".success-dialog[open]");
  await dialog.waitFor({ timeout: 15_000 });
  const centered = await dialog.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return Math.abs(box.left + box.width / 2 - innerWidth / 2) <= 2 &&
      Math.abs(box.top + box.height / 2 - innerHeight / 2) <= 2;
  });
  await screenshotViewport(page, viewport, "success-dialog");
  await page.locator(".close-dialog").click();
  await page.locator(".success-dialog[open]").waitFor({ state: "detached", timeout: 5_000 });
  await settle(page, 160);
  return centered;
}

try {
  if (managedServer) {
    testSystem = await createTestSystem();
    server = testSystem.app.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseURL = `http://127.0.0.1:${server.address().port}`;
  }

  await waitForServer();
  browser = await chromium.launch({ executablePath, headless: true });

  for (const viewport of viewports) {
    const context = await browser.newContext(contextOptions(viewport));
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    const consoleErrors = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator("#loader").waitFor({ state: "detached", timeout: 4_000 }).catch(() => {});
    await page.locator(".form-next").waitFor({ state: "attached", timeout: 5_000 });
    await settle(page, 600);
    await page.locator("video").evaluateAll((videos) => videos.forEach((video) => video.pause()));

    const heroMetrics = await page.evaluate(({ width, height }) => {
      const rect = (element) => {
        if (!element) return null;
        const value = element.getBoundingClientRect();
        return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
      };
      const nav = rect(document.querySelector("#nav"));
      const title = rect(document.querySelector(".hero-title"));
      const ctas = rect(document.querySelector(".hero-ctas"));
      const cueElement = document.querySelector(".hero-scroll-cue");
      const cueVisible = !!cueElement && getComputedStyle(cueElement).display !== "none";
      const cue = cueVisible ? rect(cueElement) : null;
      const intersects = (a, b) => a && b && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      const cursorHidden = [...document.querySelectorAll(".cursor,.cursor-ring")].every((element) => {
        const style = getComputedStyle(element);
        return style.display === "none" || style.visibility === "hidden";
      });
      return {
        viewport: { width: innerWidth, height: innerHeight },
        scrollY,
        navBox: nav,
        titleBox: title,
        ctaBox: ctas,
        horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
        cueVisible,
        cueOverlapsCtas: cueVisible ? intersects(cue, ctas) : false,
        cueGap: cueVisible && cue && ctas ? Math.max(cue.top - ctas.bottom, ctas.top - cue.bottom) : null,
        ctaBottomSafe: height <= 500 ? !!ctas && innerHeight - ctas.bottom >= 16 : true,
        titleClearsNav: height <= 500 ? !!title && !!nav && title.top - nav.bottom >= 8 : true,
        touchCursorHidden: width <= 1024 ? cursorHidden : true
      };
    }, { width: viewport.width, height: viewport.height });
    await screenshotViewport(page, viewport, "hero");

    await scrollToSection(page, "#sobre");
    await page.locator("#sobre[data-why-v2]").waitFor({ state: "visible", timeout: 5_000 });
    await settle(page, 180);
    const aboutMetrics = await page.evaluate(() => {
      const rect = (element) => {
        if (!element) return null;
        const value = element.getBoundingClientRect();
        return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
      };
      const section = rect(document.querySelector("#sobre[data-why-v2]"));
      const inner = rect(document.querySelector("#sobre .why-v2-inner"));
      const pillars = [...document.querySelectorAll("#sobre .why-v2-pillar")].map(rect).filter(Boolean);
      return {
        metadataVisible: false,
        metadataBox: null,
        statBox: null,
        metadataOverlapsStat: false,
        whySectionPresent: !!section,
        whyInsideViewport: !!inner && inner.left >= -1 && inner.right <= innerWidth + 1,
        whyPillarsVisible: pillars.length === 5 && pillars.every((pillar) => pillar.width > 0 && pillar.height > 0)
      };
    });
    await screenshotViewport(page, viewport, "sobre");

    await scrollToSection(page, "#orcamento");
    const formMetrics = await page.evaluate(() => {
      const rect = (element) => {
        if (!element) return null;
        const value = element.getBoundingClientRect();
        return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
      };
      const card = rect(document.querySelector(".orcamento-form-card"));
      const action = rect(document.querySelector(".form-next"));
      const actionStyle = getComputedStyle(document.querySelector(".form-next"));
      const copy = rect(document.querySelector(".orcamento-copy-column"));
      const form = rect(document.querySelector(".orcamento-form-card"));
      const inside = (outer, inner, inset = 0) => !!outer && !!inner &&
        inner.left >= outer.left + inset - 1 && inner.right <= outer.right - inset + 1 &&
        inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
      return {
        actionInsideCard: inside(card, action),
        actionRoundedBothSides: parseFloat(actionStyle.borderTopLeftRadius) >= 20 &&
          parseFloat(actionStyle.borderTopRightRadius) >= 20 &&
          parseFloat(actionStyle.borderBottomLeftRadius) >= 20 &&
          parseFloat(actionStyle.borderBottomRightRadius) >= 20,
        desktopTwoColumns: innerWidth >= 1180 ? !!copy && !!form && copy.right < form.left : true
      };
    });
    await screenshotViewport(page, viewport, "orcamento-step1");

    await openStepThree(page, viewport);
    const stepThreeMetrics = await page.evaluate(() => {
      const rect = (element) => {
        if (!element) return null;
        const value = element.getBoundingClientRect();
        return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
      };
      const card = rect(document.querySelector(".orcamento-form-card"));
      const consent = rect(document.querySelector(".consent"));
      const control = rect(document.querySelector(".consent-control"));
      const submit = rect(document.querySelector(".form-submit"));
      const textSelectors = [
        ".upload-card h4", ".upload-card p", ".form-note", ".form-step[data-step='3'] .form-field label",
        ".form-step[data-step='3'] textarea", ".summary", ".consent", ".form-actions"
      ];
      const textBlocks = [...document.querySelectorAll(textSelectors.join(","))].map(rect);
      const inside = (outer, inner, inset = 0) => !!outer && !!inner &&
        inner.left >= outer.left + inset - 1 && inner.right <= outer.right - inset + 1 &&
        inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
      const submitStyle = getComputedStyle(document.querySelector(".form-submit"));
      return {
        consentInsideCard: inside(card, consent),
        consentControlBox: control,
        consentTouchTarget: !!control && control.width >= 43.9 && control.height >= 43.9,
        textClearsCardEdges: textBlocks.every((block) => inside(card, block, 8)),
        submitInsideCard: inside(card, submit),
        submitRoundedBothSides: parseFloat(submitStyle.borderTopLeftRadius) >= 20 && parseFloat(submitStyle.borderTopRightRadius) >= 20
      };
    });

    if (formStateScreenshots.has(viewport.name)) {
      await page.locator(".consent").scrollIntoViewIfNeeded();
      await settle(page, 180);
      await screenshotViewport(page, viewport, "form-step3-consent");
    }
    const dialogCentered = await captureSuccessAndClose(page, viewport);
    const modalClosed = await page.locator(".success-dialog[open]").count() === 0;
    await scrollToSection(page, "#contacto");
    await screenshotViewport(page, viewport, "contacto");
    if (requiredScreenshots.has(viewport.name)) {
      await page.locator(".contact-v2-layout").scrollIntoViewIfNeeded();
      await settle(page, 180);
      await screenshotViewport(page, viewport, "contacto-details");
    }

    results.push({
      ...viewport,
      motion,
      ...heroMetrics,
      ...aboutMetrics,
      ...formMetrics,
      ...stepThreeMetrics,
      dialogCentered,
      modalClosedBeforeContact: modalClosed,
      consoleErrors
    });
    console.log(`[${motion}] ${viewport.name} complete (${results.length}/${viewports.length})`);
    await context.close();
  }
} finally {
  if (browser) await bounded(browser.close(), 5_000);
  if (server) {
    server.closeAllConnections?.();
    server.close();
    await bounded(once(server, "close"), 2_000);
  }
  if (testSystem) await bounded(testSystem.close(), 2_000);
}

const resultPath = path.join(reportRoot, `results-${motion}-${offset}-${offset + viewports.length - 1}.json`);
await fs.writeFile(resultPath, `${JSON.stringify(results, null, 2)}\n`);
const failures = results.filter((result) =>
  result.horizontalOverflow > 1 ||
  result.cueOverlapsCtas ||
  !result.ctaBottomSafe ||
  !result.titleClearsNav ||
  !result.touchCursorHidden ||
  result.metadataOverlapsStat ||
  !result.whySectionPresent ||
  !result.whyInsideViewport ||
  !result.whyPillarsVisible ||
  !result.actionInsideCard ||
  !result.actionRoundedBothSides ||
  !result.desktopTwoColumns ||
  !result.consentInsideCard ||
  !result.consentTouchTarget ||
  !result.textClearsCardEdges ||
  !result.submitInsideCard ||
  !result.submitRoundedBothSides ||
  result.dialogCentered === false ||
  !result.modalClosedBeforeContact ||
  result.consoleErrors.length
);
console.log(JSON.stringify({ motion, viewports: results.length, failures }, null, 2));
process.exit(failures.length ? 1 : 0);