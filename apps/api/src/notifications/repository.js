export class NotificationRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  recoverStaleProcessing(staleBefore) {
    return this.prisma.notificationDelivery.updateMany({
      where: { status: "PROCESSING", processingStartedAt: { lt: staleBefore } },
      data: { status: "RETRY", processingStartedAt: null, nextAttemptAt: new Date() }
    });
  }

  async claimNext(now) {
    const candidates = await this.prisma.notificationDelivery.findMany({
      where: { status: { in: ["PENDING", "RETRY"] }, nextAttemptAt: { lte: now } },
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      take: 25
    });
    for (const candidate of candidates) {
      const claimed = await this.prisma.notificationDelivery.updateMany({
        where: { id: candidate.id, status: { in: ["PENDING", "RETRY"] } },
        data: { status: "PROCESSING", processingStartedAt: now }
      });
      if (claimed.count) {
        return this.prisma.notificationDelivery.findUniqueOrThrow({
          where: { id: candidate.id },
          include: {
            case: true,
            leadSubmission: { include: { extras: true, media: { orderBy: [{ category: "asc" }, { position: "asc" }] } } }
          }
        });
      }
    }
    return null;
  }

  markSent(deliveryId, providerMessageId) {
    return this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: "SENT", providerMessageId, sentAt: new Date(), processingStartedAt: null, lastErrorCode: null, lastErrorMessage: null }
    });
  }

  async markRetryOrFailed(delivery, providerError, nextAttemptAt) {
    const attempts = delivery.attempts + 1;
    const terminal = !providerError.retryable || attempts >= 6;
    const updated = await this.prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: terminal ? "FAILED" : "RETRY",
        attempts,
        nextAttemptAt,
        processingStartedAt: null,
        lastErrorCode: providerError.code || "email_provider_error",
        lastErrorMessage: String(providerError.message || "Email provider request failed").slice(0, 240),
        ...(terminal ? { failedAt: new Date() } : {})
      }
    });
    return { updated, terminal };
  }
}
