import fs from "node:fs/promises";
import { storagePath } from "../media/local-storage.js";
import { toProviderError } from "../whatsapp/errors.js";

const retryDelaysMs = [0, 30_000, 120_000, 600_000, 1_800_000, 7_200_000];

export class DeliveryRunner {
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
    void this.run().catch((error) => this.logger.error("whatsapp.runner_error", { errorType: error?.name || "Error", providerCode: error?.code || "unknown" }));
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
      let result;
      if (delivery.kind === "SUMMARY") {
        result = await this.adapter.sendLeadSummary({ to: delivery.destinationPhoneE164, lead: delivery.leadSubmission });
      } else {
        const media = delivery.leadMedia;
        if (!media) throw new Error("Delivery media is missing");
        let metaMediaId = media.metaMediaId;
        if (!metaMediaId) {
          const filePath = storagePath(this.config, media.storageKey);
          await fs.access(filePath);
          ({ mediaId: metaMediaId } = await this.adapter.uploadLeadImage({ filePath, mimeType: media.mimeType }));
          await this.repository.saveUploadedMedia(media.id, metaMediaId);
        }
        result = await this.adapter.sendLeadImage({ to: delivery.destinationPhoneE164, mediaId: metaMediaId, media });
      }
      await this.repository.markAccepted(delivery.id, result.messageId);
      this.logger.info("whatsapp.delivery_accepted", { submissionId: delivery.leadSubmissionId, deliveryId: delivery.id, kind: delivery.kind });
      if (delivery.kind === "IMAGE") await this.deleteAcceptedLocalMedia(delivery.leadMedia);
    } catch (error) {
      const providerError = toProviderError(error);
      if (providerError.mediaExpired && delivery.leadMedia) await this.repository.clearUploadedMedia(delivery.leadMedia.id);
      const nextAttemptAt = new Date(Date.now() + retryDelaysMs[Math.min(delivery.attempts + 1, retryDelaysMs.length - 1)]);
      const outcome = await this.repository.markRetryOrFailed(delivery, providerError, nextAttemptAt);
      this.logger[outcome.terminal ? "error" : "warn"](outcome.terminal ? "whatsapp.delivery_failed" : "whatsapp.delivery_retry", {
        submissionId: delivery.leadSubmissionId,
        deliveryId: delivery.id,
        retryable: providerError.retryable,
        providerCode: providerError.code
      });
    }
  }

  async deleteAcceptedLocalMedia(media) {
    try {
      await fs.rm(storagePath(this.config, media.storageKey), { force: true });
      await this.repository.markLocalDeleted(media.id);
    } catch (error) {
      this.logger.warn("media.delete_deferred", { mediaId: media.id, errorType: error?.name || "Error" });
    }
  }
}
