# 0007 — socket.io para realtime (PvP, presence, notificações)

- **Status**: accepted
- **Data**: 2026-06-04
- **Decisor(es)**: equipe core

## Contexto

PvP, matchmaking e notificações (mint, marketplace) exigem baixa latência. Polling geraria múltiplos requests por usuário e UX ruim.

## Decisão

- **socket.io** anexado ao `httpServer` do Fastify (`apps/api/src/gateway/socket.ts`).
- Adapter Redis (`@socket.io/redis-adapter`) para múltiplos workers.
- Auth no handshake via JWT `type=access` (nunca refresh).
- Salas: `user:<id>` (push 1:1), `match:<id>` (PvP), `presence` (broadcast leve).
- Eventos tipados em `packages/shared/src/schemas/notifications.ts` (`SocketEvent`).
- Rate limit de eventos por socket (30/s) no Redis.

## Consequências

- ✅ Um canal para PvP + notificações + presence.
- ✅ Cliente web usa `socket.io-client` com reconexão e refresh de token.
- ⚠️ CSP precisa permitir `wss:` em `connect-src`.
- ⚠️ Estado de partida PvP ainda é MVP (fila Redis + match simples); evoluir com Prisma `Match`.
