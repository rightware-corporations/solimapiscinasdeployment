import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import request from "supertest";
import sharp from "sharp";

const dbPath = path.resolve("prisma/test.db");
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:./test.db";
process.env.STORAGE_ROOT = path.resolve("storage/test");
before(async () => {
  fs.rmSync(dbPath, { force: true });
  const db = new DatabaseSync(dbPath);
  db.exec(fs.readFileSync("prisma/migrations/20260726170000_init/migration.sql", "utf8"));
  db.close();
});
const { app, prisma } = await import("../server.js");
after(async () => { await prisma.$disconnect(); });

const valid = {
  customerName: "Ana Manjate",
  phone: "824407120",
  location: "Maputo, Sommerschield",
  serviceType: "NEW_CONSTRUCTION",
  extras: JSON.stringify(["LED", "DECK"]),
  notes: "Piscina residencial.",
  consentGiven: "true",
  startedAt: String(Date.now() - 5000),
  website: ""
};
const submit = (key, values = valid) => {
  let req = request(app).post("/api/quote-requests").set("Idempotency-Key", key);
  for (const [name, value] of Object.entries(values)) req = req.field(name, value);
  return req;
};

test("creates a valid ticket and preserves idempotency", async () => {
  const key = crypto.randomUUID();
  const first = await submit(key);
  assert.equal(first.status, 201);
  assert.match(first.body.ticketNumber, /^SOL-\d{8}-[2-9A-HJ-NP-Z]{6}$/);
  const second = await submit(key);
  assert.equal(second.status, 200);
  assert.equal(second.body.ticketNumber, first.body.ticketNumber);
});
test("rejects invalid phone and arbitrary service", async () => {
  const badPhone = await submit(crypto.randomUUID(), { ...valid, phone: "123" });
  assert.equal(badPhone.status, 422);
  const badService = await submit(crypto.randomUUID(), { ...valid, serviceType: "HACK" });
  assert.equal(badService.status, 422);
});
test("stores a real image and rejects disguised SVG", async () => {
  const image = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#22c7e8" } }).jpeg().toBuffer();
  let good = submit(crypto.randomUUID()).attach("locationPhotos", image, { filename: "local.jpg", contentType: "image/jpeg" });
  const saved = await good;
  assert.equal(saved.status, 201);
  assert.equal(saved.body.uploadedFiles.location, 1);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const bad = await submit(crypto.randomUUID()).attach("locationPhotos", svg, { filename: "foto.jpg", contentType: "image/jpeg" });
  assert.equal(bad.status, 422);
});
test("admin routes require authentication", async () => {
  const response = await request(app).get("/admin/requests");
  assert.equal(response.status, 302);
  assert.equal(response.headers.location, "/admin/login");
});
