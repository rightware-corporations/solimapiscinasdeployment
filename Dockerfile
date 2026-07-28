FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
RUN npx prisma generate
EXPOSE 3000
CMD ["sh","-c","npx prisma migrate deploy && node server.js"]
