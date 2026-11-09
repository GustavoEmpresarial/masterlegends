FROM node:26-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/logging/package.json packages/logging/
COPY apps/worker/package.json apps/worker/
COPY apps/api/prisma apps/api/prisma
RUN npm install -w @mll/worker -w @mll/shared -w @mll/logging --ignore-scripts

FROM node:26-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY packages/shared packages/shared
COPY packages/logging packages/logging
COPY apps/worker apps/worker
COPY apps/api/prisma apps/api/prisma
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build -w @mll/shared && npm run build -w @mll/logging
RUN npm run build -w @mll/worker

FROM node:26-alpine
RUN apk add --no-cache libc6-compat openssl
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 workeruser
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/logging/package.json ./packages/logging/package.json
COPY --from=builder /app/packages/logging/dist ./packages/logging/dist
COPY --from=builder /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
WORKDIR /app/apps/worker
USER workeruser
CMD ["node", "dist/main.js"]
