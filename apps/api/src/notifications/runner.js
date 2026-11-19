import fs from "node:fs/promises";
import { storagePath } from "../media/local-storage.js";
import { renderLeadNotification } from "../email/render.js";
import { EmailProviderError, toEmailProviderError } from "../email/errors.js";

const retryDelaysMs = [0, 30_000, 120_000, 600_000, 1_800_000, 7_200_000];

export class NotificationRunner {
  constructor({ repository, adapter, config, logger }) {
    this.repository = repository;
    this.adapter = adapter;
    this.config = config;
    this.logger = logger;
    this.active = null;
    this.timer = null;
    this.stopped = false;
  }

  kick() {
    if (this.stopped || this.active) return;
    void this.run().catch((error) => this.logger.error("email.runner_error", { errorType: error?.name || "Error", providerCode: error?.code || "unknown" }));
  }

  startRecovery() {
    if (this.timer || this.stopped) return;
    this.timer = setInterval(() => this.kick(), this.config.deliveryRecoveryIntervalMs);
    this.timer.unref?.();
    this.kick();
  }

  async stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.active;
  }

  async run() {
    if (this.active) return this.active;
    this.active = this.runLoop();
    try { return await this.active; } finally { this.active = null; }
  }

  async runLoop() {
    await this.repository.recoverStaleProcessing(new Date(Date.now() - 5 * 60_000));
    while (!this.stopped) {
      const delivery = await this.repository.claimNext(new Date());
      if (!delivery) break;
      await this.process(delivery);
    }
  }

  async process(delivery) {
    try {
      if (delivery.channel !== "EMAIL" || delivery.kind !== "LEAD_INTERNAL") {
        throw new EmailProviderError("Unsupported notification delivery", { code: "unsupported_delivery", retryable: false });
      }
      const attachments = delivery.leadSubmission.media.map((media) => ({
        filename: `${media.category.toLowerCase()}-${media.position + 1}.jpg`,
        path: storagePath(this.config, media.storageKey),
        contentType: "image/jpeg"
      }));
      const totalBytes = delivery.leadSubmission.media.reduce((total, media) => total + media.sizeBytes, 0);
      if (totalBytes > this.config.email.maxAttachmentBytes) {
        throw new EmailProviderError("Email attachments exceed the configured limit", { code: "attachments_too_large", retryable: false });
      }
      await Promise.all(attachments.map((attachment) => fs.access(attachment.path)));
      const result = await this.adapter.send({ ...renderLeadNotification({ config: this.config, delivery }), attachments });
      await this.repository.markSent(delivery.id, result.messageId);
      this.logger.info("email.delivery_sent", { submissionId: delivery.leadSubmissionId, deliveryId: delivery.id, attachmentCount: attachments.length });
    } catch (error) {
      const providerError = toEmailProviderError(error);
      const nextAttemptAt = new Date(Date.now() + retryDelaysMs[Math.min(delivery.attempts + 1, retryDelaysMs.length - 1)]);
      const outcome = await this.repository.markRetryOrFailed(delivery, providerError, nextAttemptAt);
      this.logger[outcome.terminal ? "error" : "warn"](outcome.terminal ? "email.delivery_failed" : "email.delivery_retry", {
        submissionId: delivery.leadSubmissionId,
        deliveryId: delivery.id,
        retryable: providerError.retryable,
        providerCode: providerError.code
      });
    }
  }
}
