import crypto from "node:crypto";

const statusMap = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" };

function signatureIsValid(rawBody, signature, secret) {
  if (!signature?.startsWith("sha256=") || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signature.slice("sha256=".length);
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
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
      const statuses = payload.entry?.flatMap((entry) => entry.changes || []).flatMap((change) => change.value?.statuses || []) || [];
      for (const status of statuses) {
        const nextStatus = statusMap[status.status];
        if (!nextStatus || !status.id) continue;
        const eventAt = Number.isFinite(Number(status.timestamp)) ? new Date(Number(status.timestamp) * 1_000) : new Date();
        const error = status.errors?.[0] ? { code: String(status.errors[0].code || "provider_failed"), message: String(status.errors[0].title || "Provider reported failure") } : undefined;
        const result = await repository.updateFromWebhook(status.id, nextStatus, eventAt, error);
        if (!result.matched) logger.warn("whatsapp.webhook_unknown_message", { requestId: req.id });
      }
      return res.sendStatus(200);
    }
  };
}
