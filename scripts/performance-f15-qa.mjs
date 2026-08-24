import { once } from "node:events";
import { chromium } from "playwright";
import { createTestSystem } from "../tests/support.js";

const executablePath = process.env.BROWSER_PATH || chromium.executablePath();
const results = [];
let system;
let server;
let browser;

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  system = await createTestSystem();
  server = system.app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseURL = `http://127.0.0.1:${server.address().port}`;

  const checks = [
    ["/", /no-cache/i, "HTML must remain revalidated"],
    ["/privacy.html", /no-cache/i, "privacy HTML must remain revalidated"],
    ["/css/tokens.css", /public,\s*max-age=3600/i, "CSS should use bounded public caching"],
    ["/js/app.js", /public,\s*max-age=3600/i, "JS should use bounded public caching"],
    ["/assets/solima-embedded-1.jpg", /public,\s*max-age=3600/i, "images should use bounded public caching"],
    ["/assets/brand/solima-compact-mark.svg", /public,\s*max-age=3600/i, "brand SVG should use bounded public caching"],
    ["/health", /no-store/i, "health must never be cached"],
  ];

  for (const [pathname, expected, label] of checks) {
    const response = await fetch(`${baseURL}${pathname}`);
    const cacheControl = response.headers.get("cache-control") || "";
    expect(response.ok, `${pathname} returned ${response.status}`);
    expect(expected.test(cacheControl), `${label}: ${pathname} cache-control=${cacheControl}`);
    if (/\.(?:css|js|jpg|svg)$/i.test(pathname)) {
      expect(Boolean(response.headers.get("etag")), `${pathname} is missing ETag validation`);
    }
    results.push({ name: `cache ${pathname}`, passed: true });
  }

  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

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
  const videoRequests = [];
  const thirdPartyScripts = [];
  page.on("request", (request) => {
    const url = request.url();
    if (/videos\.pexels\.com|\.mp4(?:\?|$)/i.test(url)) videoRequests.push(url);
    if (request.resourceType() === "script" && !url.startsWith(baseURL)) thirdPartyScripts.push(url);
  });

  await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator("[data-projects-v2]").waitFor({ state: "attached", timeout: 5_000 });
  await page.waitForTimeout(250);

  const metrics = await page.evaluate(() => {
    const projectImages = [...document.querySelectorAll(".projeto-image-wrap img")];
    const videos = [...document.querySelectorAll(".hero-video-layer video")];
    const canvases = [...document.querySelectorAll("canvas")];
    const webglLikeScripts = [...document.scripts]
      .map((script) => script.src || script.textContent || "")
      .filter((value) => /three(?:\.min)?\.js|@react-three|3dsvg/i.test(value));
    return {
      heroMode: document.querySelector(".hero")?.dataset.heroMode || "",
      projectImages: projectImages.map((image) => ({
        loading: image.loading,
        decoding: image.decoding,
        src: image.getAttribute("src") || "",
      })),
      videos: videos.map((video) => ({
        src: video.getAttribute("src") || "",
        preload: video.preload,
      })),
      canvasCount: canvases.length,
      webglLikeScriptCount: webglLikeScripts.length,
      serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    };
  });

  expect(metrics.heroMode === "STATIC_PREMIUM", `Save-Data hero should fail closed to STATIC_PREMIUM, got ${metrics.heroMode}`);
  expect(metrics.videos.every((video) => !video.src && video.preload === "none"), `Save-Data video sources/preload not fully disabled: ${JSON.stringify(metrics.videos)}`);
  expect(videoRequests.length === 0, `Save-Data triggered third-party video requests: ${videoRequests.join(" | ")}`);
  expect(metrics.projectImages.length === 6, `expected 6 project images, got ${metrics.projectImages.length}`);
  expect(metrics.projectImages.every((image) => image.loading === "lazy" && image.decoding === "async"), `project images are not lazy/async: ${JSON.stringify(metrics.projectImages)}`);
  expect(metrics.canvasCount === 0, `unexpected canvas/WebGL surface in landing: ${metrics.canvasCount}`);
  expect(metrics.webglLikeScriptCount === 0, `unexpected 3D/WebGL runtime dependency: ${metrics.webglLikeScriptCount}`);
  expect(!metrics.serviceWorkerControlled, "landing unexpectedly uses a service worker/PWA controller");
  expect(metrics.horizontalOverflow <= 1, `horizontal overflow ${metrics.horizontalOverflow}px`);
  expect(thirdPartyScripts.length <= 2, `unexpected third-party script expansion: ${thirdPartyScripts.join(" | ")}`);
  results.push({ name: "Save-Data / lazy media budget", passed: true });

  await context.close();

  console.log(JSON.stringify({ total: results.length, passed: results.length, failed: 0, results }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ total: results.length + 1, passed: results.length, failed: 1, failure: error.message }, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  if (server) await new Promise((resolve) => server.close(resolve));
  await system?.close().catch(() => {});
}
