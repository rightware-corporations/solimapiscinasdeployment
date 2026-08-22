import crypto from "node:crypto";

const statusMap = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" };

function signatureIsValid(rawBody, signature, secret) {
  if (!signature?.startsWith("sha256=") || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signature.slice("sha256=".length);
  if (!/^[a-f0-9]{64}$/i.test(received) || received.length !== expected.length) return false;
  const receivedBuffer = Buffer.from(received, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return receivedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

function extractStatuses(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.entry)) return null;
  const statuses = [];
  for (const entry of payload.entry) {
    if (!entry || !Array.isArray(entry.changes)) return null;
    for (const change of entry.changes) {
      if (!change || !change.value || !Array.isArray(change.value.statuses)) continue;
      statuses.push(...change.value.statuses);
    }
  }
  return statuses;
}

function parseEventAt(timestamp) {
  const seconds = Number(timestamp);
  const date = new Date(seconds * 1_000);
  return Number.isFinite(seconds) && Number.isFinite(date.getTime()) ? date : new Date();
}

export function createWebhookHandlers({ config, repository, logger }) {
  return {
    verify(req, res) {
      if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === config.whatsapp.webhookVerifyToken) {
        return res.status(200).type("text/plain").send(String(req.query["hub.challenge"] || ""));
      }
      return res.sendStatus(403);
    },
    async receive(req, res) {
      if (!Buffer.isBuffer(req.body) || !signatureIsValid(req.body, req.get("X-Hub-Signature-256"), config.whatsapp.appSecret)) {
        logger.warn("whatsapp.webhook_rejected", { requestId: req.id });
        return res.sendStatus(401);
      }
      let payload;
      try { payload = JSON.parse(req.body.toString("utf8")); } catch { return res.sendStatus(400); }
      const statuses = extractStatuses(payload);
      if (!statuses) return res.sendStatus(400);
      for (const status of statuses) {
        const nextStatus = statusMap[status.status];
        if (!nextStatus || !status.id) continue;
        const eventAt = parseEventAt(status.timestamp);
        const error = status.errors?.[0] ? { code: String(status.errors[0].code || "provider_failed"), message: String(status.errors[0].title || "Provider reported failure") } : undefined;
        const result = await repository.updateFromWebhook(status.id, nextStatus, eventAt, error);
        if (!result.matched) logger.warn("whatsapp.webhook_unknown_message", { requestId: req.id });
      }
      return res.sendStatus(200);
    }
  };
}
