const includeLeadGraph = {
  extras: true,
  media: { orderBy: [{ category: "asc" }, { position: "asc" }] },
  deliveries: { orderBy: { sequence: "asc" } },
  notificationDeliveries: { orderBy: { createdAt: "asc" } },
  case: true
};

const successfulStatuses = new Set(["ACCEPTED", "SENT", "DELIVERED", "READ"]);

export class LeadRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  findByIdempotencyKey(idempotencyKey) {
    return this.prisma.leadSubmission.findUnique({ where: { idempotencyKey }, include: includeLeadGraph });
  }

  async createGraph({ lead, media, deliveries = [], caseRecord, notificationDelivery }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.leadSubmission.create({
        data: {
          ...lead,
          extras: { create: lead.extras.map((code) => ({ code })) },
          media: { create: media }
        }
      });
      if (deliveries.length) await tx.whatsAppDelivery.createMany({ data: deliveries });
      await tx.case.create({ data: caseRecord });
      if (notificationDelivery) await tx.notificationDelivery.create({ data: notificationDelivery });
      return tx.leadSubmission.findUniqueOrThrow({ where: { id: lead.id }, include: includeLeadGraph });
    });
  }

  async recoverStaleProcessing(staleBefore) {
    return this.prisma.whatsAppDelivery.updateMany({
      where: { status: "PROCESSING", processingStartedAt: { lt: staleBefore } },
      data: { status: "RETRY", processingStartedAt: null, nextAttemptAt: new Date() }
    });
  }

  async claimNext(now) {
    const candidates = await this.prisma.whatsAppDelivery.findMany({
      where: { status: { in: ["PENDING", "RETRY"] }, nextAttemptAt: { lte: now } },
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      take: 25
    });
    for (const candidate of candidates) {
      const prior = await this.prisma.whatsAppDelivery.findFirst({
        where: {
          leadSubmissionId: candidate.leadSubmissionId,
          sequence: { lt: candidate.sequence },
          status: { in: ["PENDING", "PROCESSING", "RETRY", "FAILED"] }
        },
        select: { id: true }
      });
      if (prior) continue;
      const claimed = await this.prisma.whatsAppDelivery.updateMany({
        where: { id: candidate.id, status: { in: ["PENDING", "RETRY"] } },
        data: { status: "PROCESSING", processingStartedAt: now }
      });
      if (claimed.count) {
        return this.prisma.whatsAppDelivery.findUniqueOrThrow({
          where: { id: candidate.id },
          include: { leadSubmission: { include: { extras: true } }, leadMedia: true }
        });
      }
    }
    return null;
  }

  async saveUploadedMedia(mediaId, metaMediaId) {
    await this.prisma.leadMedia.update({ where: { id: mediaId }, data: { metaMediaId } });
  }

  async clearUploadedMedia(mediaId) {
    await this.prisma.leadMedia.update({ where: { id: mediaId }, data: { metaMediaId: null, expiresAt: null } });
  }

  async markAccepted(deliveryId, metaMessageId) {
    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.whatsAppDelivery.update({
        where: { id: deliveryId },
        data: { status: "ACCEPTED", metaMessageId, acceptedAt: new Date(), processingStartedAt: null, lastErrorCode: null, lastErrorMessage: null }
      });
      await this.refreshAggregate(tx, delivery.leadSubmissionId);
      return delivery;
    });
  }

  async markRetryOrFailed(delivery, providerError, nextAttemptAt) {
    const attempts = delivery.attempts + 1;
    const terminal = !providerError.retryable || attempts >= 6;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.whatsAppDelivery.update({
        where: { id: delivery.id },
        data: {
          status: terminal ? "FAILED" : "RETRY",
          attempts,
          nextAttemptAt,
          processingStartedAt: null,
          lastErrorCode: providerError.code || "provider_error",
          lastErrorMessage: String(providerError.message || "Provider request failed").slice(0, 240),
          ...(terminal ? { failedAt: new Date() } : {})
        }
      });
      await this.refreshAggregate(tx, delivery.leadSubmissionId);
      return { updated, terminal };
    });
  }

  async markLocalDeleted(mediaId) {
    await this.prisma.leadMedia.update({ where: { id: mediaId }, data: { localDeletedAt: new Date(), status: "DELETED" } });
  }

  async updateFromWebhook(metaMessageId, nextStatus, eventAt, error) {
    const delivery = await this.prisma.whatsAppDelivery.findFirst({ where: { metaMessageId } });
    if (!delivery) return { matched: false };
    const precedence = { PENDING: 0, RETRY: 0, PROCESSING: 0, ACCEPTED: 1, SENT: 2, DELIVERED: 3, READ: 4, FAILED: 5 };
    if (
      (nextStatus === "FAILED" && ["DELIVERED", "READ"].includes(delivery.status)) ||
      (precedence[nextStatus] ?? -1) <= (precedence[delivery.status] ?? -1) ||
      delivery.status === "FAILED"
    ) return { matched: true, updated: false };
    const timestamp = eventAt || new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.whatsAppDelivery.update({
        where: { id: delivery.id },
        data: {
          status: nextStatus,
          ...(nextStatus === "SENT" ? { sentAt: timestamp } : {}),
          ...(nextStatus === "DELIVERED" ? { deliveredAt: timestamp } : {}),
          ...(nextStatus === "READ" ? { readAt: timestamp } : {}),
          ...(nextStatus === "FAILED" ? { failedAt: timestamp, lastErrorCode: error?.code || "provider_failed", lastErrorMessage: error?.message?.slice(0, 240) || "Provider reported failure" } : {})
        }
      });
      await this.refreshAggregate(tx, delivery.leadSubmissionId);
    });
    return { matched: true, updated: true };
  }

  async refreshAggregate(tx, leadSubmissionId) {
    const deliveries = await tx.whatsAppDelivery.findMany({ where: { leadSubmissionId }, select: { status: true } });
    let deliveryStatus = "DELIVERING";
    if (deliveries.some((delivery) => delivery.status === "FAILED")) deliveryStatus = "FAILED";
    else if (deliveries.length && deliveries.every((delivery) => successfulStatuses.has(delivery.status))) deliveryStatus = "ACCEPTED";
    else if (deliveries.some((delivery) => successfulStatuses.has(delivery.status))) deliveryStatus = "PARTIAL";
    await tx.leadSubmission.update({ where: { id: leadSubmissionId }, data: { deliveryStatus } });
  }
}
