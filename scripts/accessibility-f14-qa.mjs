import { once } from "node:events";
import { chromium } from "playwright";
import { createTestSystem } from "../tests/support.js";

const viewports = [
  { name: "360x640", width: 360, height: 640, mobile: true },
  { name: "400x900-reflow", width: 400, height: 900, mobile: true },
  { name: "768x1024", width: 768, height: 1024, mobile: false },
  { name: "1440x900", width: 1440, height: 900, mobile: false },
];

const executablePath = process.env.BROWSER_PATH || chromium.executablePath();

let system;
let server;
let browser;
const results = [];

function contextOptions(viewport) {
  return {
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
    deviceScaleFactor: viewport.mobile ? 2 : 1,
  };
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
    await page.locator("[data-quote-v2]").waitFor({ state: "attached", timeout: 5_000 });
    await page.waitForTimeout(180);

    const semantics = await page.evaluate(() => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return !element.hidden
          && style.display !== "none"
          && style.visibility !== "hidden"
          && rect.width > 0
          && rect.height > 0;
      };

      const accessibleName = (element) => {
        const ariaLabel = element.getAttribute("aria-label")?.trim();
        if (ariaLabel) return ariaLabel;
        const labelledBy = element.getAttribute("aria-labelledby");
        if (labelledBy) {
          const text = labelledBy.split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() || "")
            .filter(Boolean)
            .join(" ");
          if (text) return text;
        }
        if (element.labels?.length) {
          const text = [...element.labels].map((label) => label.textContent?.replace(/\s+/g, " ").trim() || "").join(" ");
          if (text) return text;
        }
        return element.textContent?.replace(/\s+/g, " ").trim()
          || element.getAttribute("title")?.trim()
          || element.getAttribute("alt")?.trim()
          || "";
      };

      const ids = [...document.querySelectorAll("[id]")].map((element) => element.id).filter(Boolean);
      const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
      const visibleImagesWithoutAlt = [...document.querySelectorAll("img")]
        .filter(visible)
        .filter((image) => !image.hasAttribute("alt"))
        .map((image) => image.src);
      const visibleUnnamedInteractive = [...document.querySelectorAll('a[href], button, input:not([type="hidden"]), textarea, select')]
        .filter(visible)
        .filter((element) => !accessibleName(element))
        .map((element) => `${element.tagName.toLowerCase()}.${element.className || ""}`);
      const positiveTabindex = [...document.querySelectorAll("[tabindex]")]
        .filter((element) => Number(element.getAttribute("tabindex")) > 0)
        .map((element) => `${element.tagName.toLowerCase()}#${element.id || ""}`);
      const visibleH1 = [...document.querySelectorAll("h1")].filter(visible);
      const labelledSections = [...document.querySelectorAll("section[aria-labelledby]")]
        .every((section) => Boolean(document.getElementById(section.getAttribute("aria-labelledby"))));
      const quote = document.querySelector("[data-quote-v2]");
      const phoneLabel = quote?.querySelector('label[for="phone"]')?.textContent?.replace(/\s+/g, " ").trim() || "";
      const status = quote?.querySelector(".form-status");
      const success = quote?.querySelector(".success-dialog");
      return {
        lang: document.documentElement.lang,
        visibleH1Count: visibleH1.length,
        duplicateIds: duplicates,
        visibleImagesWithoutAlt,
        visibleUnnamedInteractive,
        positiveTabindex,
        labelledSections,
        phoneLabel,
        formStatusLive: status?.getAttribute("aria-live") || "",
        successDialogLabelledBy: success?.getAttribute("aria-labelledby") || "",
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      };
    });

    const failures = [];
    if (!/^pt(?:-|$)/i.test(semantics.lang)) failures.push(`unexpected document language: ${semantics.lang}`);
    if (semantics.visibleH1Count !== 1) failures.push(`expected exactly one visible h1, got ${semantics.visibleH1Count}`);
    if (semantics.duplicateIds.length) failures.push(`duplicate IDs: ${semantics.duplicateIds.join(", ")}`);
    if (semantics.visibleImagesWithoutAlt.length) failures.push(`visible images without alt attribute: ${semantics.visibleImagesWithoutAlt.join(" | ")}`);
    if (semantics.visibleUnnamedInteractive.length) failures.push(`unnamed interactive controls: ${semantics.visibleUnnamedInteractive.join(" | ")}`);
    if (semantics.positiveTabindex.length) failures.push(`positive tabindex found: ${semantics.positiveTabindex.join(" | ")}`);
    if (!semantics.labelledSections) failures.push("one or more aria-labelledby section references are broken");
    if (semantics.phoneLabel !== "Telefone *") failures.push(`phone label still assumes WhatsApp or is incorrect: ${semantics.phoneLabel}`);
    if (semantics.formStatusLive !== "polite") failures.push(`form status aria-live should be polite, got ${semantics.formStatusLive}`);
    if (semantics.successDialogLabelledBy !== "success-title") failures.push(`success dialog label is broken: ${semantics.successDialogLabelledBy}`);
    if (semantics.horizontalOverflow > 1) failures.push(`horizontal overflow ${semantics.horizontalOverflow}px`);

    // Skip-link keyboard behavior and visible focus indication.
    await page.keyboard.press("Tab");
    const skipFocus = await page.evaluate(() => {
      const active = document.activeElement;
      const style = active ? getComputedStyle(active) : null;
      const rect = active?.getBoundingClientRect();
      return {
        isSkip: Boolean(active?.matches?.("[data-skip-link]")),
        outline: style?.outlineStyle || "none",
        visible: Boolean(rect && rect.width > 0 && rect.height > 0),
      };
    });
    if (!skipFocus.isSkip) failures.push("skip link is not first keyboard focus target");
    if (skipFocus.outline === "none") failures.push("skip link lacks a visible focus outline");
    if (!skipFocus.visible) failures.push("focused skip link is not visible");

    // Mobile menu: keyboard-open, focus enters menu, Escape returns to burger.
    if (viewport.width < 900) {
      const burger = page.locator("#navBurger");
      await burger.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(40);
      const opened = await page.evaluate(() => ({
        expanded: document.querySelector("#navBurger")?.getAttribute("aria-expanded"),
        overlayHidden: document.querySelector("#navOverlay")?.getAttribute("aria-hidden"),
        focusInside: Boolean(document.activeElement?.closest?.("#navOverlay")),
      }));
      if (opened.expanded !== "true" || opened.overlayHidden !== "false" || !opened.focusInside) {
        failures.push(`mobile menu keyboard open/focus failed: ${JSON.stringify(opened)}`);
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(20);
      const closed = await page.evaluate(() => ({
        expanded: document.querySelector("#navBurger")?.getAttribute("aria-expanded"),
        focusReturned: document.activeElement === document.querySelector("#navBurger"),
      }));
      if (closed.expanded !== "false" || !closed.focusReturned) failures.push(`mobile menu Escape/focus restore failed: ${JSON.stringify(closed)}`);
    }

    // Contextual quote dialog: accessible dialog semantics, focus, Escape restore.
    const serviceCta = page.locator('.service-v2-quote-cta[data-service-type="NEW_CONSTRUCTION"]').first();
    await serviceCta.scrollIntoViewIfNeeded();
    await serviceCta.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(50);
    const quoteOpen = await page.evaluate(() => {
      const quote = document.querySelector("[data-quote-v2]");
      const close = quote?.querySelector(".quote-v2-task-close");
      return {
        role: quote?.getAttribute("role") || "",
        modal: quote?.getAttribute("aria-modal") || "",
        labelled: quote?.getAttribute("aria-label") || "",
        closeFocused: document.activeElement === close,
        selectedService: quote?.querySelector('input[name="serviceType"]:checked')?.value || "",
      };
    });
    if (quoteOpen.role !== "dialog" || quoteOpen.modal !== "true" || !quoteOpen.labelled) failures.push(`quote dialog semantics failed: ${JSON.stringify(quoteOpen)}`);
    if (!quoteOpen.closeFocused) failures.push("quote task does not place focus on its close control");
    if (quoteOpen.selectedService !== "NEW_CONSTRUCTION") failures.push(`service context was not preselected: ${quoteOpen.selectedService}`);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(30);
    const quoteClosed = await page.evaluate(() => ({
      stillOpen: document.querySelector("[data-quote-v2]")?.classList.contains("quote-v2-task-open") || false,
      triggerFocused: Boolean(document.activeElement?.matches?.('.service-v2-quote-cta[data-service-type="NEW_CONSTRUCTION"]')),
    }));
    if (quoteClosed.stillOpen || !quoteClosed.triggerFocused) failures.push(`quote Escape/focus restore failed: ${JSON.stringify(quoteClosed)}`);

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
