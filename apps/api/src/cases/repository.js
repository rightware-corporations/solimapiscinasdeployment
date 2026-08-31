export class CaseRepository {
  constructor(prisma) { this.prisma = prisma; }

  findIntentByReference(referenceCode) {
    return this.prisma.intent.findUnique({ where: { referenceCode } });
  }

  createFromIntent({ caseRecord, intentId }) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.case.create({ data: { ...caseRecord, sourceIntentId: intentId } });
      await tx.intent.update({ where: { id: intentId }, data: { convertedAt: new Date() } });
      return created;
    });
  }
}
