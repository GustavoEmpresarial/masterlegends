FROM node:26-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
# Web não usa Prisma — ignora postinstall do monorepo (db:generate)
RUN npm install -w @mll/web -w @mll/shared --ignore-scripts --include=dev

FROM node:26-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/shared/dist packages/shared/dist
COPY apps/web apps/web
ARG VITE_API_URL=
ARG VITE_SOCKET_PATH=/socket.io
ARG VITE_CHAIN_ID=137
ARG VITE_RPC_URL=https://polygon-bor-rpc.publicnode.com
ARG VITE_USDC=
ARG VITE_CONTRACT_USDC_VAULT=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_PATH=$VITE_SOCKET_PATH
ENV VITE_CHAIN_ID=$VITE_CHAIN_ID
ENV VITE_RPC_URL=$VITE_RPC_URL
ENV VITE_USDC=$VITE_USDC
ENV VITE_CONTRACT_USDC_VAULT=$VITE_CONTRACT_USDC_VAULT
# DevDeps do Vite ficam em apps/web/node_modules (não hoistadas ao root)
RUN npm install -w @mll/web --include=dev --ignore-scripts
RUN npm run build -w @mll/web

FROM nginx:alpine
RUN apk add --no-cache wget
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 15000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:15000/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
