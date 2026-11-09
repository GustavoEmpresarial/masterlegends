FROM node:26-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/logging/package.json packages/logging/
COPY apps/api/package.json apps/api/
RUN npm install -w @mll/api -w @mll/shared -w @mll/logging --ignore-scripts

FROM node:26-alpine
RUN apk add --no-cache libc6-compat openssl wget
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY packages/shared packages/shared
COPY packages/logging packages/logging
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build -w @mll/shared && npm run build -w @mll/logging
RUN npm run build
RUN chmod +x docker-entrypoint.sh
RUN chown -R appuser:nodejs /app
USER appuser
EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
