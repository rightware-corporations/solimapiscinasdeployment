import crypto from "node:crypto";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import { config } from "./src/config.js";
import { parseQuote } from "./src/validation.js";
import { createPublicToken, createTicket } from "./src/ticket.js";
import { processImage, removeProcessed } from "./src/storage.js";
import { processOutbox } from "./src/outbox.js";
import { adminRouter } from "./src/admin.js";

export const prisma = new PrismaClient();
export const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((req, res, next) => {
  req.id = req.get("X-Request-ID")?.slice(0, 80) || crypto.randomUUID();
  res.set("X-Request-ID", req.id);
  next();
});
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https://images.pexels.com"],
      mediaSrc: ["'self'", "blob:", "https://videos.pexels.com"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginResourcePolicy: { policy: "same-site" }
}));
app.use(cors({ origin: (origin, cb) => cb(null, !origin || origin === config.allowedOrigin), credentials: true }));
app.use(express.json({ limit: "64kb" }));
app.use(rateLimit({ windowMs: 15 * 60_000, limit: 240, standardHeaders: "draft-8", legacyHeaders: false }));

const uploadLimiter = rateLimit({ windowMs: 30 * 60_000, limit: 12, standardHeaders: "draft-8", legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 8, standardHeaders: "draft-8", legacyHeaders: false });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 7, fields: 20, fieldSize: 16_000 } });

app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

app.post("/api/quote-requests", uploadLimiter, upload.fields([{ name: "locationPhotos", maxCount: 5 }, { name: "inspirationPhotos", maxCount: 2 }]), async (req, res, next) => {
  const idempotencyKey = req.get("Idempotency-Key");
  if (!idempotencyKey || idempotencyKey.length > 100) return res.status(400).json({ success: false, error: "Idempotency-Key inválida." });
  const existing = await prisma.quoteRequest.findUnique({ where: { idempotencyKey }, include: { files: true } });
  if (existing) {
    return res.status(200).json(response(existing));
  }
  const parsed = parseQuote({ ...req.body, extras: req.body.extras ? JSON.parse(req.body.extras) : [] });
  if (!parsed.success) return res.status(422).json({ success: false, error: "Verifique os campos indicados.", fields: parsed.error.flatten().fieldErrors });
  if (parsed.data.website || (parsed.data.startedAt && Date.now() - parsed.data.startedAt < 1800)) return res.status(400).json({ success: false, error: "Não foi possível validar a submissão." });
  const files = req.files || {};
  const processed = [];
  try {
    for (const file of files.locationPhotos || []) processed.push(await processImage(file, "LOCATION"));
    for (const file of files.inspirationPhotos || []) processed.push(await processImage(file, "INSPIRATION"));
    const ticketNumber = createTicket();
    const quote = await prisma.$transaction(async (tx) => {
      const created = await tx.quoteRequest.create({
        data: {
          ticketNumber,
          publicStatusToken: createPublicToken(),
          idempotencyKey,
          customerName: parsed.data.customerName,
          phoneE164: parsed.data.phone,
          location: parsed.data.location,
          serviceType: parsed.data.serviceType,
          extrasJson: JSON.stringify(parsed.data.extras),
          notes: parsed.data.notes || null,
          consentGiven: true,
          files: { create: processed },
          history: { create: { newStatus: "RECEIVED", actorType: "SYSTEM", note: "Pedido recebido." } }
        },
        include: { files: true }
      });
      await tx.outboxEvent.create({
        data: {
          quoteRequestId: created.id,
          eventType: "QUOTE_REQUEST_RECEIVED",
          payload: JSON.stringify({ ticketNumber, customerName: created.customerName, phoneE164: created.phoneE164, location: created.location, serviceType: created.serviceType })
        }
      });
      return created;
    });
    res.status(201).json(response(quote));
  } catch (error) {
    await removeProcessed(processed);
    next(error);
  }
});

function response(quote) {
  return {
    success: true,
    ticketNumber: quote.ticketNumber,
    status: quote.status,
    createdAt: quote.createdAt.toISOString(),
    uploadedFiles: {
      location: quote.files.filter((f) => f.category === "LOCATION").length,
      inspiration: quote.files.filter((f) => f.category === "INSPIRATION").length
    },
    notificationStatus: quote.notificationStatus
  };
}

app.get("/api/quote-requests/status/:ticketNumber", async (req, res) => {
  const quote = await prisma.quoteRequest.findFirst({ where: { ticketNumber: req.params.ticketNumber, publicStatusToken: String(req.query.token || "") } });
  if (!quote) return res.sendStatus(404);
  res.json({ ticketNumber: quote.ticketNumber, status: quote.status, createdAt: quote.createdAt, updatedAt: quote.updatedAt });
});

app.use("/admin", adminRouter(express, prisma, loginLimiter));
app.use(express.static("public", { maxAge: config.nodeEnv === "production" ? "7d" : 0, etag: true }));
app.use((error, req, res, next) => {
  console.error(JSON.stringify({ level: "error", requestId: req.id, message: String(error.message || error).slice(0, 500) }));
  const uploadError = error instanceof multer.MulterError || /imagem|ficheiro|formato/i.test(error.message || "");
  res.status(uploadError ? 422 : 500).json({ success: false, error: uploadError ? error.message : "Não foi possível concluir o pedido. Tente novamente." });
});

let worker;
if (process.env.NODE_ENV !== "test") worker = setInterval(() => processOutbox(prisma).catch(() => {}), 15_000);
if (process.env.NODE_ENV !== "test") {
  const server = app.listen(config.port, () => console.log(JSON.stringify({ level: "info", message: "SOLIMA online", port: config.port })));
  const shutdown = async () => {
    clearInterval(worker);
    server.close(async () => { await prisma.$disconnect(); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
