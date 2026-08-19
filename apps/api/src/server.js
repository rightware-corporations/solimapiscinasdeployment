import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./config/env.js";
import { createPrisma } from "./db/prisma.js";
import { createLogger } from "./lib/logger.js";
import { LeadRepository } from "./leads/repository.js";
import { LeadService } from "./leads/service.js";
import { DeliveryRunner } from "./deliveries/runner.js";
import { FakeWhatsAppAdapter, MetaWhatsAppAdapter } from "./whatsapp/adapter.js";
import { createApp } from "./app.js";

async function ensureWritableStorage(config) {
  await fs.mkdir(config.storageRoot, { recursive: true });
  await fs.mkdir(config.rawUploadRoot, { recursive: true });
  const probe = path.join(config.storageRoot, `.health-${process.pid}`);
  await fs.writeFile(probe, "");
  await fs.rm(probe, { force: true });
}

export async function startServer({ environment, adapter } = {}) {
  const config = loadConfig(environment);
  const logger = createLogger({ level: config.logLevel });
  await ensureWritableStorage(config);
  const prisma = createPrisma(config);
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  const repository = new LeadRepository(prisma);
  const whatsappAdapter = adapter || (config.whatsapp.enabled ? new MetaWhatsAppAdapter({ config }) : new FakeWhatsAppAdapter());
  const runner = new DeliveryRunner({ repository, adapter: whatsappAdapter, config, logger });
  const leadService = new LeadService({ repository, config, deliveryRunner: runner, logger });
  const app = createApp({ config, prisma, leadService, repository, logger });
  const server = app.listen(config.port, () => logger.info("app.started", { port: config.port }));
  runner.startRecovery();

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("app.shutdown");
    const force = setTimeout(() => server.closeAllConnections?.(), 25_000);
    force.unref?.();
    await Promise.all([runner.stop(), new Promise((resolve) => server.close(resolve))]);
    clearTimeout(force);
    await prisma.$disconnect();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  return { app, server, prisma, runner, shutdown, adapter: whatsappAdapter };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error) => {
    console.error(JSON.stringify({ level: "error", event: "app.start_failed", message: String(error.message || error).slice(0, 240) }));
    process.exitCode = 1;
  });
}
