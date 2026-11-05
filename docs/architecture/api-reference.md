# Referência da API HTTP

Inventário gerado a partir de `apps/api/src/modules/**/*.routes.ts` e [`app.ts`](../../apps/api/src/app.ts).

**Contratos request/response:** schemas Zod e DTOs em [`packages/shared/src/schemas/`](../../packages/shared/src/schemas/). Este doc lista rotas — não duplica payloads.

---

## Convenções

| Prefixo | Auth | Notas |
|---------|------|-------|
| `/health` | — | Health check |
| `/stats` | — | Público |
| `/auth` | Misto | Público exceto `/me`, alterações de conta |
| `/api/*` | Bearer JWT | `authGuard` global em todas as rotas |
| `/admin/api/*` | Admin JWT | 2FA no login; permissões por role |

**CSRF:** rotas com cookie de refresh (`/auth/refresh`, `/auth/logout`, admin equivalentes) exigem header `X-CSRF-Token` (obtido via `GET */csrf`).

**Email verificado:** scout e marketplace search exigem `emailVerifiedAt` (`verifiedEmailGuard`).

---

## Sistema

| Método | Path | Módulo | Descrição |
|--------|------|--------|-----------|
| GET | `/health` | `app.ts` | Status OK + timestamp |

---

## Stats (público) — `/stats`

| Método | Path | Arquivo | Descrição |
|--------|------|---------|-----------|
| GET | `/stats/public` | `stats.routes.ts` | Métricas públicas da plataforma |
| GET | `/stats/public/wallet-activity` | `stats.routes.ts` | Feed recente depósitos/saques |
| GET | `/stats/ranking/clubs` | `stats.routes.ts` | Ranking de clubes |
| GET | `/stats/ranking/clubs/:clubName` | `stats.routes.ts` | Perfil de um clube no ranking |
| GET | `/stats/ranking/players` | `stats.routes.ts` | Ranking de jogadores |
| GET | `/stats/social/videos` | `stats.routes.ts` | Vídeos aprovados (programa social) |

---

## Auth — `/auth`

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/auth/csrf` | — | Token CSRF |
| POST | `/auth/register` | — | Registro (Turnstile se configurado) |
| POST | `/auth/login` | — | Login email/senha |
| POST | `/auth/refresh` | Cookie | Rotaciona refresh token |
| POST | `/auth/logout` | Cookie | Revoga sessão |
| GET | `/auth/me` | Bearer | Perfil do usuário |
| POST | `/auth/change-password` | Bearer | Alterar senha |
| POST | `/auth/change-username` | Bearer | Alterar username |
| GET | `/auth/wallet/challenge` | Bearer | Challenge para link de wallet |
| POST | `/auth/wallet/link` | Bearer | Vincular wallet (assinatura) |
| DELETE | `/auth/wallet/link` | Bearer | Desvincular wallet |
| POST | `/auth/forgot-password` | — | Iniciar reset (sempre 200) |
| POST | `/auth/reset-password` | — | Completar reset |
| POST | `/auth/verify-email` | — | Verificar email com token |
| POST | `/auth/nonce` | — | Web3 stub → **501** (fase 1) |
| POST | `/auth/verify` | — | Web3 stub → **501** (fase 1) |

Implementação: [`auth.routes.ts`](../../apps/api/src/modules/auth/auth.routes.ts) → `AuthService`.

---

## Player API — `/api/*`

Todas exigem `Authorization: Bearer <accessToken>`.

### Club — `/api/club`

| Método | Path | Service | Descrição |
|--------|------|---------|-----------|
| GET | `/api/club/` | `ClubService.getClub` | Clube + métricas farm |
| POST | `/api/club/create` | `ClubService.createClub` | Criar clube |
| GET | `/api/club/inventory` | `ClubService.getInventory` | Jogadores do usuário |
| POST | `/api/club/upgrade/:building` | `ClubService.upgradeBuilding` | Upgrade edifício |

`:building` ∈ `stadium` \| `ct` \| `treasurer` \| `trophyRoom`

### Scout — `/api/scout`

| Método | Path | Service | Descrição |
|--------|------|---------|-----------|
| POST | `/api/scout/mint` | `ScoutService.mint` | Mint off-chain (`BasePlayer`) |

Requer email verificado. Schema: `scoutMintSchema`.

### Marketplace — `/api/marketplace`

| Método | Path | Service | Descrição |
|--------|------|---------|-----------|
| GET | `/api/marketplace/search` | `MarketplaceService` | Buscar listagens |
| POST | `/api/marketplace/list` | `MarketplaceService` | Listar jogador |
| POST | `/api/marketplace/buy/:listingId` | `MarketplaceService` | Comprar |
| POST | `/api/marketplace/cancel/:listingId` | `MarketplaceService` | Cancelar listagem |

### Wallet — `/api/wallet`

| Método | Path | Service | Descrição |
|--------|------|---------|-----------|
| GET | `/api/wallet/summary` | `WalletService` | Saldo e resumo |
| GET | `/api/wallet/transactions` | `WalletService` | Histórico |
| POST | `/api/wallet/withdraw-requests` | `WalletService` | Solicitar saque |
| GET | `/api/wallet/withdraw-requests` | `WalletService` | Listar solicitações |

### Pass — `/api/pass`

| Método | Path | Service | Descrição |
|--------|------|---------|-----------|
| GET | `/api/pass/progress` | `PassService` | Progresso da temporada |
| POST | `/api/pass/claim/:level` | `PassService` | Resgatar nível |
| POST | `/api/pass/premium` | `PassService` | Comprar premium |

### Mining — `/api/mining`

| Método | Path | Service | Descrição |
|--------|------|---------|-----------|
| GET | `/api/mining/me` | `MiningService` | Resumo do usuário |
| GET | `/api/mining/blocks` | `MiningService` | Blocos recentes |
| GET | `/api/mining/history` | `MiningService` | Histórico de recompensas |

### Referrals — `/api/referrals`

| Método | Path | Service | Descrição |
|--------|------|---------|-----------|
| GET | `/api/referrals/stats` | `ReferralsService` | Código, indicados, ganhos |

### Stadium — `/api/stadium`

| Método | Path | Service | Descrição |
|--------|------|---------|-----------|
| GET | `/api/stadium/view` | `StadiumPlayerService` | Vista do estádio + lineup |
| PUT | `/api/stadium/lineup` | `StadiumPlayerService` | Salvar lineup |
| GET | `/api/stadium/shop` | `StadiumShopService` | Itens da loja |
| POST | `/api/stadium/shop/buy` | `StadiumShopService` | Comprar item |

### Vestiário — `/api/vestiario`

| Método | Path | Service | Descrição |
|--------|------|---------|-----------|
| GET | `/api/vestiario/` | `VestiarioService` | Vista do vestiário |
| POST | `/api/vestiario/rest` | `VestiarioService` | Descanso diário |
| PUT | `/api/vestiario/lineup` | `VestiarioService` | Salvar lineup |

### PvP — `/api/pvp`

| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/api/pvp/match` | **501** — usar Socket.IO (`pvp:queue`) |

### Announcements — `/api/announcements`

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/api/announcements/active` | Anúncio ativo para o usuário |
| POST | `/api/announcements/:id/dismiss` | Dispensar anúncio |

### Support — `/api/support`

| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/api/support/tickets` | Criar ticket (JSON ou multipart) |
| GET | `/api/support/tickets` | Listar tickets do usuário |
| GET | `/api/support/tickets/:id` | Detalhe do ticket |
| POST | `/api/support/tickets/:id/messages` | Nova mensagem |
| GET | `/api/support/attachments/:id` | Download de anexo |

### Social — `/api/social`

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/api/social/me` | Status de criador YouTube |
| POST | `/api/social/apply` | Candidatar-se a criador |
| PATCH | `/api/social/profile` | Atualizar perfil criador |
| POST | `/api/social/videos` | Submeter URL de vídeo |

---

## Admin API — `/admin/api`

### Auth admin

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/admin/api/csrf` | CSRF admin |
| POST | `/admin/api/login` | Login (→ 2FA ou sessão) |
| POST | `/admin/api/verify-2fa` | Completar 2FA |
| POST | `/admin/api/refresh` | Refresh sessão admin |
| POST | `/admin/api/logout` | Logout |
| GET | `/admin/api/me` | Sessão admin atual |

### Painel — `admin-panel.routes.ts`

| Método | Path | Área |
|--------|------|------|
| GET | `/admin/api/overview` | Dashboard |
| GET | `/admin/api/users` | Listar usuários |
| GET | `/admin/api/users/:id` | Detalhe usuário |
| GET | `/admin/api/users/:id/account` | Painel conta |
| POST | `/admin/api/users/:id/ban` | Banir |
| POST | `/admin/api/users/:id/unban` | Desbanir |
| POST | `/admin/api/users/:id/deactivate` | Desativar |
| POST | `/admin/api/users/:id/reactivate` | Reativar |
| POST | `/admin/api/users/:id/reset-password` | Reset forçado |
| GET | `/admin/api/reports/summary` | Relatórios |
| GET | `/admin/api/reports/deposits` | Depósitos |
| GET | `/admin/api/reports/withdrawals` | Saques |
| GET | `/admin/api/withdrawals` | Fila de saques |
| POST | `/admin/api/withdrawals/:id/approve` | Aprovar saque |
| POST | `/admin/api/withdrawals/:id/reject` | Rejeitar saque |
| GET/PATCH | `/admin/api/wallet-config` | Config plataforma |
| GET/POST/PATCH/DELETE | `/admin/api/announcements` | CRUD anúncios |
| GET/POST/PATCH/DELETE | `/admin/api/pass/seasons` | Temporadas passe |
| GET | `/admin/api/pass/template` | Template default |
| GET/POST/PATCH | `/admin/api/support/tickets` | Suporte admin |
| GET | `/admin/api/support/attachments/:id` | Anexo |
| GET | `/admin/api/referrals/overview` | Overview referrals |
| GET | `/admin/api/referrals` | Lista referrals |
| GET | `/admin/api/audit-logs` | Audit log |
| GET/POST | `/admin/api/social/creators/*` | Moderar criadores |
| GET/POST | `/admin/api/social/videos/*` | Moderar vídeos |

### Items (scout pool) — `item-template.routes.ts`

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/admin/api/items` | Listar templates |
| POST | `/admin/api/items` | Criar (multipart) |
| PATCH | `/admin/api/items/:id` | Atualizar |
| POST | `/admin/api/items/:id/active` | Toggle ativo |
| DELETE | `/admin/api/items/:id` | Remover |

### Stadiums — `stadium.routes.ts`

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/admin/api/stadiums` | Listar templates |
| GET | `/admin/api/stadiums/:id` | Detalhe |
| POST | `/admin/api/stadiums` | Criar (multipart) |
| PATCH | `/admin/api/stadiums/:id` | Atualizar |
| POST | `/admin/api/stadiums/:id/active` | Toggle ativo |
| DELETE | `/admin/api/stadiums/:id` | Remover |

### Stadium shop admin — `stadium-shop-admin.routes.ts`

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/admin/api/stadium-shop/items` | Listar itens |
| POST | `/admin/api/stadium-shop/items` | Criar |
| PATCH | `/admin/api/stadium-shop/items/:id` | Atualizar |

---

## WebSocket (Socket.IO)

Não é HTTP — documentado em [`realtime.md`](./realtime.md).

| Direção | Evento | Payload |
|---------|--------|---------|
| → server | `pvp:queue` | — |
| → server | `pvp:play` | — |
| → server | `pvp:use-booster` | `{ id }` |
| → server | `presence:heartbeat` | — |
| ← server | `pvp:matched` | match + players |
| ← server | `pvp:round-result` | round scores |
| ← server | `notification` | `NotificationPayload` |
| ← server | `presence:update` | `{ userId, online }` |

Tipos: [`packages/shared/src/schemas/notifications.ts`](../../packages/shared/src/schemas/notifications.ts).

---

## Códigos de erro

Enum `ErrorCode` em [`packages/shared/src/errors.ts`](../../packages/shared/src/errors.ts). Resposta padrão:

```json
{ "error": { "code": "ERROR_CODE", "message": "..." } }
```

---

## Cliente web

Hooks que consomem esta API: [`apps/web/src/hooks/useApi.ts`](../../apps/web/src/hooks/useApi.ts).

Axios: [`apps/web/src/lib/api/client.ts`](../../apps/web/src/lib/api/client.ts).
