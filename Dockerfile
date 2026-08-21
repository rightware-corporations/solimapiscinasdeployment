FROM node:22-bookworm-slim AS base
WORKDIR /app

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS runtime
ENV NODE_ENV=production

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json ./

COPY apps/api/prisma ./apps/api/prisma
RUN ./node_modules/.bin/prisma generate --schema apps/api/prisma/schema.prisma

COPY apps/api/src ./apps/api/src
COPY apps/web ./apps/web

EXPOSE 3000

CMD ["sh", "-c", "mkdir -p /app/data && touch /app/data/solima.db && ./node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/src/server.js"]