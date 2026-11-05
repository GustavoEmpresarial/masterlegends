# Realtime — WebSocket Gateway

Comunicação em tempo real via **socket.io**, bootada após o Fastify (`apps/api/src/gateway/socket.ts`). O servidor é anexado ao mesmo `httpServer`, então o path padrão `/socket.io` viaja na mesma porta da API.

## Handshake e autenticação

- Cliente conecta com `auth: { token: <accessToken JWT> }` no handshake.
- Middleware `attachSocketAuth` (`apps/api/src/gateway/auth.middleware.ts`) verifica o JWT via `app.jwt.verify`. Tokens `type=refresh` são rejeitados.
- Em sucesso, `socket.data.user = { id, email }`. Em falha, o socket é descartado com erro `WS_UNAUTHORIZED`.
- Quando o access token expira durante a sessão, o cliente recebe `connect_error` e reconecta com o token novo (`refreshSocketAuth()` em `apps/web/src/lib/socket/client.ts`).

## Salas padrão

Ao conectar, todo socket entra em:
- `user:<userId>` — canal 1:1 para notificações.
- `presence` — broadcast leve de quem entrou/saiu.

## Presence

`apps/api/src/gateway/presence.ts` rastreia online via Redis:
- `SADD online:users <userId>` + key dedicada `online:user:<id>` com TTL 60s.
- Heartbeat do cliente a cada 30s renova a TTL.
- Disconnect só marca offline quando **todos** os sockets do usuário caem (suporte a múltiplas abas).
- Broadcast em `presence:update` para a sala `presence`.

## PvP

> `POST /api/pvp/match` retorna `501 NOT_IMPLEMENTED`. Matchmaking usa Socket.IO.

`apps/api/src/gateway/rooms/pvp.room.ts`:
- Cliente emite `pvp:queue`. Servidor faz `LPOP` atômico em `pvp:queue` (Redis list).
- Sem oponente disponível → `RPUSH` da entrada `{ userId, socketId, enqueuedAt }`.
- Match feito → ambos sockets entram em `match:<matchId>`, emit `pvp:matched`.
- Estado das rodadas é **server-authoritative**: cliente emite `pvp:play` (sem valores), servidor calcula e broadcasta `pvp:round-result`.
- Disconnect limpa entradas órfãs da fila.

## Notificações

`NotificationsService` é instanciado em `setupSocketGateway` como `app.notifications`. Expõe `notify(userId, type, data)` → `io.to('user:<id>').emit('notification', payload)`. Módulos da API podem chamar `app.notifications.notify(...)` após mutações relevantes.

## Rate-limit

`apps/api/src/gateway/rateLimit.ts` decora cada socket autenticado com um middleware `socket.use` que conta eventos por usuário em Redis (`ws:rl:<userId>`). Excesso = erro `WS_RATE_LIMITED`.

## Multi-process

Adapter Redis (`@socket.io/redis-adapter`) garante que broadcasts emitidos por uma instância da API chegam a clientes conectados em outras instâncias.

## Eventos canônicos

Definidos em `packages/shared/src/schemas/notifications.ts` como `SocketEvent` (constante). Cliente e servidor importam dali — nada inline:

| Direção | Evento | Payload |
|---|---|---|
| ← server | `notification` | `NotificationPayload` |
| ← server | `pvp:matched` | `{ matchId, rounds, playerA, playerB }` |
| ← server | `pvp:round-result` | `{ matchId, round, winner, scoreA, scoreB }` |
| ← server | `presence:update` | `{ userId, online }` |
| → server | `pvp:queue` | (vazio) |
| → server | `pvp:play` | (vazio — server calcula) |
| → server | `pvp:use-booster` | `{ id }` (validação server-side) |
| → server | `presence:heartbeat` | (vazio, a cada 30s) |
