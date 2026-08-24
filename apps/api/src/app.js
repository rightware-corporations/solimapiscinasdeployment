import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createWebhookHandlers } from "./whatsapp/webhook.js";
import { requestId } from "./middleware/request-id.js";
import { securityMiddleware } from "./middleware/security.js";
import { createLeadLimiter } from "./middleware/rate-limit.js";
import { createUpload } from "./middleware/multipart.js";
import { notFound } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";
import { mountLeadRoutes } from "./leads/routes.js";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web");
const cacheableStaticExtensions = new Set([
  ".css",
  ".js",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".svg",
  ".ico",
]);

function setStaticCacheHeaders(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html") {
    res.setHeader("Cache-Control", "no-cache");
    return;
  }
  if (cacheableStaticExtensions.has(extension)) {
    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    return;
  }
  res.setHeader("Cache-Control", "no-cache");
}

export function createApp({ config, prisma, leadService, repository, logger, storageFileSystem = fs }) {
  const app = express();
  app.set("trust proxy", config.trustProxy);
  app.disable("x-powered-by");
  app.use(requestId);
  app.use(securityMiddleware());

  const webhooks = createWebhookHandlers({ config, repository, logger });
  app.get("/webhooks/whatsapp", (req, res) => {
    res.set("Cache-Control", "no-store");
    return webhooks.verify(req, res);
  });
  app.post("/webhooks/whatsapp", express.raw({ type: "application/json", limit: "64kb" }), (req, res, next) => {
    res.set("Cache-Control", "no-store");
    return webhooks.receive(req, res).catch(next);
  });

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await storageFileSystem.access(config.storageRoot, fsConstants.W_OK);
      res.set("Cache-Control", "no-store").json({ status: "ok" });
    } catch {
      res.set("Cache-Control", "no-store").status(503).json({ status: "unavailable" });
    }
  });

  app.use("/api", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  app.use(express.json({ limit: "64kb" }));
  mountLeadRoutes(app, { upload: createUpload(config), uploadLimiter: createLeadLimiter(), leadService });
  app.use(express.static(webRoot, {
    etag: true,
    setHeaders: setStaticCacheHeaders,
  }));
  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
