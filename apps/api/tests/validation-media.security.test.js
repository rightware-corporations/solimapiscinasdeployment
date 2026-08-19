import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import sharp from "sharp";
import { createTestSystem, validLead } from "../../../tests/support.js";

const submit = (app, values = validLead(), key = crypto.randomUUID()) => {
  let result = request(app).post("/api/leads").set("Idempotency-Key", key);
  for (const [name, value] of Object.entries(values)) result = result.field(name, value);
  return result;
};

test("server validation normalizes Unicode and rejects invalid lead semantics", async () => {
  const system = await createTestSystem();
  try {
    system.runner.stopped = true;
    assert.equal((await submit(system.app, { ...validLead(), phone: "123" })).status, 422);
    assert.equal((await submit(system.app, { ...validLead(), serviceType: "INVOICE" })).status, 422);
    assert.equal((await submit(system.app, { ...validLead(), extras: JSON.stringify(["UNKNOWN"]) })).status, 422);
    assert.equal((await submit(system.app, { ...validLead(), consentGiven: "false" })).status, 422);
    assert.equal((await submit(system.app, { ...validLead(), customerName: "<script>x</script>" })).status, 422);
    assert.equal((await submit(system.app, { ...validLead(), startedAt: String(Date.now()), website: "robot" })).status, 400);
    assert.equal((await submit(system.app, { ...validLead(), customerName: "Ａna Manjate" })).status, 201);
    assert.equal((await system.prisma.leadSubmission.findFirstOrThrow()).customerName, "Ana Manjate");
  } finally { await system.close(); }
});

test("accepts JPEG, PNG and WebP, stores generated JPEG names and strips EXIF", async () => {
  const system = await createTestSystem();
  try {
    system.runner.stopped = true;
    const base = sharp({ create: { width: 60, height: 40, channels: 3, background: "#22c7e8" } });
    const jpeg = await base.clone().jpeg().withMetadata({ exif: { IFD0: { Artist: "SOLIMA test" } } }).toBuffer();
    const png = await base.clone().png().toBuffer();
    const webp = await base.clone().webp().toBuffer();
    const response = await submit(system.app)
      .attach("locationPhotos", jpeg, { filename: "../../local.jpg", contentType: "image/jpeg" })
      .attach("locationPhotos", png, { filename: "local.png", contentType: "image/png" })
      .attach("inspirationPhotos", webp, { filename: "reference.webp", contentType: "image/webp" });
    assert.equal(response.status, 201);
    const media = await system.prisma.leadMedia.findMany({ orderBy: { position: "asc" } });
    assert.equal(media.length, 3);
    assert.ok(media.every((item) => item.mimeType === "image/jpeg" && /^[0-9a-f-]{36}\.jpg$/.test(item.storageKey)));
    const metadata = await sharp(path.join(system.config.storageRoot, media[0].storageKey)).metadata();
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.width <= 2560 && metadata.height <= 2560, true);
  } finally { await system.close(); }
});

test("rejects disguised SVG, corrupt image data, excess files and oversized files", async () => {
  const system = await createTestSystem();
  try {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    assert.equal((await submit(system.app).attach("locationPhotos", svg, { filename: "image.jpg", contentType: "image/jpeg" })).status, 422);
    assert.equal((await submit(system.app).attach("locationPhotos", Buffer.from("not an image"), { filename: "image.png", contentType: "image/png" })).status, 422);
    const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    let tooMany = submit(system.app);
    for (let index = 0; index < 6; index += 1) tooMany = tooMany.attach("locationPhotos", image, { filename: `${index}.jpg`, contentType: "image/jpeg" });
    assert.equal((await tooMany).status, 400);
    assert.equal((await submit(system.app).attach("locationPhotos", Buffer.alloc(5 * 1024 * 1024 + 1), { filename: "large.jpg", contentType: "image/jpeg" })).status, 413);
  } finally { await system.close(); }
});

test("static hosting keeps secrets, SQLite files and pending media private", async () => {
  const system = await createTestSystem();
  try {
    const csp = (await request(system.app).get("/")).headers["content-security-policy"];
    assert.match(csp, /script-src 'self'/);
    assert.doesNotMatch(csp, /unsafe-inline/);
    for (const target of ["/.env", "/app/data/solima.db", "/pending-media/any.jpg"]) {
      assert.equal((await request(system.app).get(target)).status, 404);
    }
  } finally { await system.close(); }
});

test("forged X-Forwarded-For headers do not bypass the lead limiter with trust proxy disabled", async () => {
  const system = await createTestSystem();
  try {
    const responses = [];
    for (let index = 0; index < 13; index += 1) {
      responses.push(await request(system.app).post("/api/leads").set("X-Forwarded-For", `203.0.113.${index}`).send({}));
    }
    assert.equal(responses.at(-1).status, 429);
  } finally { await system.close(); }
});
