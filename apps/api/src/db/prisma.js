import { PrismaClient } from "@prisma/client";

export function createPrisma(config) {
  return new PrismaClient({ datasources: { db: { url: config.databaseUrl } } });
}
