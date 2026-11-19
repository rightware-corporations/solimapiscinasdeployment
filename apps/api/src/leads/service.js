import crypto from "node:crypto";
import { describeUploads } from "../media/validation.js";
import { processImages } from "../media/service.js";
import { removeStoredMedia } from "../media/local-storage.js";
import { requestFingerprint } from "./fingerprint.js";
import { createCaseReference } from "../cases/reference.js";

export class IdempotencyConflictError extends Error {}
export class DependencyUnavailableError extends Error {}

export class LeadService {
  constructor({ repository, config, deliveryRunner, logger }) {
    this.repository = repository;
    this.config = config;
    this.deliveryRunner = deliveryRunner;
    this.logger = logger;
  }

  async submit({ idempotencyKey, lead, files, requestId }) {
    if (!this.config.email.enabled || !this.config.email.to || !this.config.email.from) {
      throw new DependencyUnavailableError("A submissão está temporariamente indisponível.");
    }
    const describedUploads = await describeUploads(files, this.config);
    const fingerprint = requestFingerprint(lead, describedUploads);
    const existing = await this.repository.findByIdempotencyKey(idempotencyKey);
    if (existing) return this.resolveExisting(existing, fingerprint, requestId);

    let staged = [];
    try {
      staged = await processImages(describedUploads, this.config, this.logger);
      const leadId = crypto.randomUUID();
      const caseId = crypto.randomUUID();
      const caseRecord = {
        id: caseId, publicReference: createCaseReference(), type: "SALES", channel: "FORM",
        customerNameSnapshot: lead.customerName, phoneE164: lead.phone, location: lead.location,
        serviceType: lead.serviceType, title: `Pedido de orçamento — ${lead.customerName}`,
        description: lead.notes || null, workflowState: "NEW", priority: "NORMAL",
        sourceLeadSubmissionId: leadId
      };
      const created = await this.repository.createGraph({
        lead: {
          id: leadId,
          idempotencyKey,
          requestFingerprint: fingerprint,
          customerName: lead.customerName,
          phoneE164: lead.phone,
          location: lead.location,
          serviceType: lead.serviceType,
          notes: lead.notes || null,
          consentAt: new Date(),
          privacyPolicyVersion: this.config.privacyPolicyVersion,
          extras: lead.extras
        },
        media: staged.map(({ id, ...media }) => ({ id, ...media })),
        deliveries: [],
        caseRecord,
        notificationDelivery: {
          id: crypto.randomUUID(), leadSubmissionId: leadId, caseId,
          dedupeKey: `${leadId}:lead-internal-email:v1`, kind: "LEAD_INTERNAL", channel: "EMAIL",
          provider: this.config.email.provider.toUpperCase(), destination: this.config.email.to
        }
      });
      this.logger.info("lead.created", { requestId, submissionId: created.id, mediaCount: staged.length });
      this.deliveryRunner.kick();
      return { submission: created, replayed: false };
    } catch (error) {
      if (error.code === "P2002") {
        await removeStoredMedia(this.config, staged);
        const winner = await this.repository.findByIdempotencyKey(idempotencyKey);
        if (winner) return this.resolveExisting(winner, fingerprint, requestId);
      }
      await removeStoredMedia(this.config, staged);
      throw error;
    }
  }

  resolveExisting(existing, fingerprint, requestId) {
    if (existing.requestFingerprint !== fingerprint) {
      this.logger.warn("lead.idempotency_conflict", { requestId, submissionId: existing.id });
      throw new IdempotencyConflictError("Esta chave de envio já foi usada para outro pedido.");
    }
    this.logger.info("lead.idempotent_replay", { requestId, submissionId: existing.id });
    return { submission: existing, replayed: true };
  }

}
