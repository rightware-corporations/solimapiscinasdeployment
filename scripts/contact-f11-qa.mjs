import { once } from "node:events";
import { chromium } from "playwright";
import { createTestSystem } from "../tests/support.js";

const PHONES = [
  ["tel:+258824407120", "+258 82 440 7120"],
  ["tel:+258843892558", "+258 84 389 2558"],
  ["tel:+258847949100", "+258 84 794 9100"],
];

const CURRENT_PUBLIC_EMAIL = "solima.piscinas@gmail.com";
const OFFICIAL_WHATSAPP = "https://wa.me/258843892558";
const YOUTUBE_URL = "https://www.youtube.com/watch?v=MgiXGiHG8_I";
const forbiddenClaims = /(?:desde\s+2006|19\s*\+?|mais\s+de\s+19\s+anos|32\+|01\s*\/\s*32|100%|45\s+dias)/iu;
const forbiddenAdminHref = /(?:\/admin(?:\/|$)|\/dashboard(?:\/|$)|admin\/login|administrator|phpmyadmin|wp-admin)/iu;

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
    await page.locator("[data-contact-v2]").waitFor({ state: "attached", timeout: 5_000 });
    await page.waitForTimeout(160);

    const metrics = await page.evaluate(() => {
      const section = document.querySelector("[data-contact-v2]");
      const footer = document.querySelector("[data-footer-v2]");
      const sectionRect = section.getBoundingClientRect();
      const phones = [...section.querySelectorAll('a[data-contact-channel="PHONE"]')].map((link) => ({
        href: link.getAttribute("href") || "",
        label: link.textContent?.replace(/\s+/g, " ").trim() || "",
        width: link.getBoundingClientRect().width,
        height: link.getBoundingClientRect().height,
      }));
      const whatsappLinks = [...section.querySelectorAll('a[data-contact-channel="WHATSAPP"]')].map((link) => ({
        href: link.href,
        label: link.getAttribute("aria-label") || "",
        target: link.target,
        rel: link.rel,
        width: link.getBoundingClientRect().width,
        height: link.getBoundingClientRect().height,
      }));
      const socialLinks = [...section.querySelectorAll(".contact-v2-social-link")].map((link) => ({
        label: link.getAttribute("aria-label") || "",
        href: link.href,
        target: link.target,
        rel: link.rel,
        width: link.getBoundingClientRect().width,
        height: link.getBoundingClientRect().height,
      }));
      const phoneList = section.querySelector(".contact-v2-phone-list");
      const phoneGridColumns = getComputedStyle(phoneList).gridTemplateColumns.split(" ").filter(Boolean).length;
      const quote = section.querySelector(".contact-v2-quote-cta");
      const quoteRect = quote.getBoundingClientRect();
      const email = section.querySelector('a[data-contact-email-source="CURRENT_PUBLIC_SITE"]');
      const footerLinks = [...footer.querySelectorAll("a[href]")].map((link) => link.getAttribute("href") || "");

      return {
        styleLoaded: Boolean(document.querySelector('link[data-solima-contact-v2]')),
        uniqueContact: document.querySelectorAll("#contacto").length,
        title: section.querySelector("#contactV2Title")?.getAttribute("aria-label") || section.querySelector("#contactV2Title")?.textContent?.replace(/\s+/g, " ").trim() || "",
        contactText: section.textContent?.replace(/\s+/g, " ").trim() || "",
        footerText: footer.textContent?.replace(/\s+/g, " ").trim() || "",
        phones,
        phoneGridColumns,
        emailText: email?.textContent?.trim() || "",
        emailHref: email?.getAttribute("href") || "",
        emailSource: email?.dataset.contactEmailSource || "",
        socialLinks,
        whatsappLinks,
        singlePhonePrimaryCta: section.querySelectorAll('.contact-v2-action a[href^="tel:"]').length,
        quoteHref: quote.getAttribute("href") || "",
        quoteIntentAction: quote.dataset.intentAction || "",
        quoteIntentSource: quote.dataset.intentSource || "",
        quoteHeight: quoteRect.height,
        quoteWidth: quoteRect.width,
        legacyContactGrid: section.querySelectorAll(".contacto-grid, .contacto-social, .contacto-cta-row").length,
        footerLoaded: Boolean(footer),
        footerPrivacyHref: footer.querySelector('a[href="/privacy.html"]')?.getAttribute("href") || "",
        footerBrandHref: footer.querySelector(".contact-v2-footer-brand")?.getAttribute("href") || "",
        footerLinks,
        legacyFooterTag: footer.querySelectorAll(".footer-tag").length,
        sectionInsideViewport: sectionRect.left >= -1 && sectionRect.right <= innerWidth + 1,
        horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      };
    });

    const failures = [];
    if (!metrics.styleLoaded) failures.push("F11 stylesheet not loaded");
    if (metrics.uniqueContact !== 1) failures.push(`expected one #contacto, got ${metrics.uniqueContact}`);
    if (metrics.title !== "Estamos em Maputo. Fale com a SOLIMA.") failures.push(`unexpected accessible contact title: ${metrics.title}`);
    if (metrics.whatsappLinks.length !== 1) failures.push(`expected one official WhatsApp link, got ${metrics.whatsappLinks.length}`);
    const whatsapp = metrics.whatsappLinks[0];
    if (!whatsapp || whatsapp.href !== OFFICIAL_WHATSAPP) failures.push(`official WhatsApp link missing or wrong: ${whatsapp?.href || "none"}`);
    if (whatsapp && (!whatsapp.label.includes("+258 84 389 2558") || whatsapp.target !== "_blank")) failures.push("official WhatsApp label/target is incorrect");
    if (whatsapp && (!whatsapp.rel.split(/\s+/).includes("noopener") || !whatsapp.rel.split(/\s+/).includes("noreferrer"))) failures.push("official WhatsApp link missing noopener/noreferrer");
    if (whatsapp && (whatsapp.height < 44 || whatsapp.width < 44)) failures.push(`WhatsApp target below 44px: ${whatsapp.width}x${whatsapp.height}`);
    if (metrics.singlePhonePrimaryCta !== 0) failures.push("one phone was promoted as the primary contact CTA before business approval");
    if (metrics.phones.length !== 3) failures.push(`expected 3 phone links, got ${metrics.phones.length}`);
    PHONES.forEach(([href, label], index) => {
      const actual = metrics.phones[index];
      if (!actual || actual.href !== href || actual.label !== label) failures.push(`phone ${index + 1} mismatch: ${JSON.stringify(actual)}`);
      if (actual && actual.height < 44) failures.push(`phone ${index + 1} target below 44px: ${actual.height}`);
    });
    const expectedPhoneCols = viewport.width <= 699 ? 1 : 3;
    if (metrics.phoneGridColumns !== expectedPhoneCols) failures.push(`phone grid expected ${expectedPhoneCols} columns, got ${metrics.phoneGridColumns}`);

    if (metrics.emailText !== CURRENT_PUBLIC_EMAIL || metrics.emailHref !== `mailto:${CURRENT_PUBLIC_EMAIL}`) failures.push(`current public email changed silently: ${metrics.emailText} / ${metrics.emailHref}`);
    if (metrics.emailSource !== "OFFICIAL_APPROVED") failures.push("official public-email approval marker missing");

    if (metrics.socialLinks.length !== 4) failures.push(`expected 4 social/proof links, got ${metrics.socialLinks.length}`);
    const youtube = metrics.socialLinks.find((link) => link.label === "YouTube");
    if (!youtube || youtube.href !== YOUTUBE_URL) failures.push(`YouTube link missing or wrong: ${youtube?.href || "none"}`);
    metrics.socialLinks.forEach((link) => {
      if (link.target !== "_blank") failures.push(`${link.label} does not open externally`);
      if (!link.rel.split(/\s+/).includes("noopener") || !link.rel.split(/\s+/).includes("noreferrer")) failures.push(`${link.label} missing noopener/noreferrer`);
      if (link.height < 44 || link.width < 44) failures.push(`${link.label} target below 44px: ${link.width}x${link.height}`);
    });

    if (metrics.quoteHref !== "#orcamento" || metrics.quoteIntentAction !== "QUOTE" || metrics.quoteIntentSource !== "CONTACT") failures.push("contact quote CTA is not wired to the shared intent surface");
    if (metrics.quoteHeight < 44) failures.push(`contact quote CTA below 44px: ${metrics.quoteHeight}`);
    if (metrics.legacyContactGrid !== 0) failures.push(`legacy contact UI still rendered: ${metrics.legacyContactGrid}`);

    if (!metrics.footerLoaded) failures.push("F11 footer not rendered");
    if (metrics.footerPrivacyHref !== "/privacy.html" || metrics.footerBrandHref !== "#top") failures.push("footer navigation contract incorrect");
    if (metrics.legacyFooterTag !== 0) failures.push("legacy footer claim/tag still rendered");
    if (forbiddenClaims.test(`${metrics.contactText} ${metrics.footerText}`)) failures.push("contact/footer contains a forbidden quantified claim");
    if (metrics.footerLinks.some((href) => forbiddenAdminHref.test(href))) failures.push("footer exposes an Admin/dashboard route");
    if (!/Maputo\s*·\s*Moçambique/iu.test(metrics.footerText)) failures.push("footer location missing");
    if (!/Construção\s*&\s*Manutenção\s+de\s+Piscinas/iu.test(metrics.footerText)) failures.push("footer institutional descriptor missing");

    if (metrics.horizontalOverflow > 1) failures.push(`horizontal overflow ${metrics.horizontalOverflow}px`);
    if (!metrics.sectionInsideViewport) failures.push("contact section exceeds viewport width");

    const quote = page.locator(".contact-v2-quote-cta").first();
    await quote.click();
    await page.waitForTimeout(70);
    const quoteTask = await page.evaluate(() => {
      const section = document.querySelector("#orcamento");
      const banner = section?.querySelector(".quote-v2-context");
      return {
        open: section?.classList.contains("quote-v2-task-open") || false,
        contextType: section?.dataset.quoteContextType || "",
        bannerHidden: banner?.hidden ?? false,
      };
    });
    if (!quoteTask.open || quoteTask.contextType !== "GENERIC" || !quoteTask.bannerHidden) failures.push(`contact CTA did not open generic shared quote: ${JSON.stringify(quoteTask)}`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(50);
    const focusRestored = await quote.evaluate((element) => document.activeElement === element);
    const taskClosed = await page.locator("#orcamento").evaluate((element) => !element.classList.contains("quote-v2-task-open"));
    if (!taskClosed) failures.push("Escape did not close quote from Contact CTA");
    if (!focusRestored) failures.push("focus did not return to Contact CTA after quote close");

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
