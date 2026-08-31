export class IntentRepository {
  constructor(prisma) { this.prisma = prisma; }
  create(data) { return this.prisma.intent.create({ data }); }
}
