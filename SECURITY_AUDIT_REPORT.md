# Relatório de Auditoria de Segurança — Master Legends League

**Data:** 2026-06-13
**Escopo:** Análise completa do código-fonte (API, Web, Smart Contracts, Workers, Infraestrutura)
**Metodologia:** Revisão manual de código, análise de schemas Zod, testes de stress, varredura de endpoints

---

## Sumário Executivo

Projeto **Play-and-Earn** de futebol com integração blockchain (Polygon). Stack: Fastify 5 + React 19 + Prisma + PostgreSQL + Redis + MongoDB + BullMQ + Socket.IO + ethers.js.

**Risco Geral: MÉDIO-ALTO** (devido a operações financeiras com criptomoedas reais)

### Achados por Severidade

| Gravidade | Qtd | Descrição |
|-----------|-----|-----------|
| **CRÍTICA** | 2 | Chave privada em env var, Math.random em economia |
| **ALTA** | 3 | Swap sem validação de rota, Withdraw não atômico, Admin plaintext |
| **MÉDIA** | 7 | CSP dev, PvP anti-spam, Admin JWT fallback, CORS !origin, etc |
| **BAIXA** | 5 | Perda precisão Decimal, CSRF opt-in, 2FA disable tag, etc |

---

## 1. VALIDAÇÃO DE ENTRADA (Input Validation)

### Schema: Login (`packages/shared/src/schemas/auth.ts:69-73`)
```ts
loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
  turnstileToken: z.string().min(1).optional(),
})
```

### Schema: Registro (`packages/shared/src/schemas/auth.ts:51-67`)
```ts
registerSchema = z.object({
  email: allowlistedEmailSchema,         // Só 24 domínios (Gmail, Outlook, Yahoo, iCloud)
  password: strongPasswordSchema,         // 8+ chars, upper, lower, number, special
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  referralCode: z.string().min(4).max(8).regex(/^[A-Z0-9]+$/).optional(),
  acceptTerms: z.literal(true),
  turnstileToken: z.string().min(1).optional(),
})
```

### ❌ Gaps de Validação

| # | Rota | Problema | Arquivo |
|---|------|----------|---------|
| F1 | `POST /api/wallet/swap` | Body passado cru sem `.parse()` na rota (só no service) | `wallet.routes.ts:40` |
| F2 | `POST /api/pass/premium` | Sem validação de body | `pass.routes.ts:26` |
| F3 | `POST /api/announcements/:id/dismiss` | Type cast `as { id: string }` sem Zod | `announcement.routes.ts:20` |
| F4 | `POST /api/wallet/swap` | Service faz `.parse()` mas se refatorarem esquece | `swap.service.ts:14` |

---

## 2. SEGURANÇA DE AUTENTICAÇÃO

### ✅ Implementado
- JWT dual namespace (player + admin) com secrets separados
- Refresh token rotation com reuse detection (Redis)
- CSRF protection em refresh/logout
- Rate limit 5 req/min em auth endpoints
- Cloudflare Turnstile CAPTCHA (register + login)
- Account lockout após 5 tentativas (15 min)
- bcrypt 10 rounds para senhas
- Audit logging para todos eventos de auth
- Email verification obrigatório para saques
- Password reset invalida todas as sessões
- Token access em memória (não localStorage)

### ❌ Issues

| # | Gravidade | Descrição | Arquivo |
|---|-----------|-----------|---------|
| A1 | **Média** | `Math.random()` para referral codes — usar `crypto.randomBytes()` | `auth.service.ts:18` |
| A2 | **Baixa** | Turnstile opcional no schema Zod — deveria ser `required` quando configurado | `auth.ts:66` |
| A3 | **Baixa** | Login não normaliza email antes do parse Zod | `auth.service.ts:108` |
| A4 | **Informativo** | `password.max(128)` conflita com bcrypt (limite 72 bytes) | `auth.ts:71` |

---

## 3. OPERAÇÕES FINANCEIRAS (Wallet)

### Swap (`POST /api/wallet/swap`)
- ✅ `swapGmtSchema.parse()` no service
- ✅ `$transaction` + saldo verificado
- ✅ `applyUsdcDebit` + `applyMgtCredit` atômicos

### Depósito (`POST /api/wallet/deposits/track`)
- ✅ Verifica transação on-chain (Polygonscan + RPC fallback)
- ✅ Match de wallet do usuário com `transferLog`
- ✅ Anti-replay (txHash já creditado)
- ✅ Enfileira `ChainEvent.UsdcDeposited` via BullMQ

### Saque (`POST /api/wallet/withdraw-requests`)
- ✅ Verifica wallet vinculada, email verificado, não banido
- ✅ Verifica saldo do vault on-chain
- ✅ Verifica pending withdrawals

### ❌ Issues Financeiras

| # | Gravidade | Descrição | Arquivo |
|---|-----------|-----------|---------|
| W1 | **CRÍTICA** | **`OPERATOR_PRIVATE_KEY`** em env var — chave privada do contrato USDC Vault em texto plano. Se servidor comprometido, vault pode ser drenado | `env.ts:69` |
| W2 | **ALTA** | **Withdraw approve não é atômico** — DB atualizado para `approved`, depois tenta fulfill na chain. Se chain falhar, status fica `approved` mas usuário não recebeu | `withdrawal-request.service.ts:138-157` |
| W3 | **Média** | **Swap sem `.parse()` na rota** — depende exclusivamente do service | `wallet.routes.ts:40` |
| W4 | **Baixa** | `Number(row.amountUsdc)` perde precisão Decimal | `withdrawal-request.service.ts:29` |

---

## 4. ECONOMIA DO JOGO (Game Logic)

### ❌ Uso de `Math.random()` em operações com valor real

`Math.random()` **não é criptograficamente seguro**. Pode ser manipulado se o runtime for comprometido. O projeto já tem `secureRandom()` em `lib/secure-random.ts` mas não é usado consistentemente.

| # | Gravidade | Local | Uso | Arquivo |
|---|-----------|-------|-----|---------|
| E1 | **ALTA** | Pass Battle Pass | Gera overwall de recompensa | `pass.service.ts:54-56` |
| E2 | **ALTA** | Social YouTube | Gera overwall do jogador | `social.service.ts:93-94` |
| E3 | **Média** | Item Template | Gera overwall de template | `item-template.service.ts:164` |
| E4 | **Média** | Merge (game.ts) | `rollMergeOverwall` default `Math.random` | `game.ts:96` |
| E5 | **Média** | Auth | Geração de referral code | `auth.service.ts:18` |

### ✅ Correto: Scout usa `secureRandom` (`scout.service.ts:34`)

---

## 5. MARKETPLACE

| Operação | Validação | Proteção |
|----------|-----------|----------|
| `GET /api/marketplace/search` | `listingsQuerySchema.parse()` | Filtra sellerId do viewer |
| `POST /api/marketplace/list` | `listItemSchema.parse()` | Verifica ownership, rarity > 0 |
| `POST /api/marketplace/buy/:id` | `buyListingParamsSchema.parse()` | `$transaction` + feeBps |
| `POST /api/marketplace/list-bulk` | `z.array().min(1).max(50)` | Batch com erro individual |
| `POST /api/marketplace/cancel/:id` | `cancelListingParamsSchema.parse()` | Verifica ownership |

**Conclusão:** Marketplace bem implementado. Transações atômicas, race conditions improváveis.

---

## 6. ADMIN PANEL

### Permissões (RBAC)

| Role | Acesso |
|------|--------|
| `super_admin` | Tudo |
| `ops` | Gerenciamento de usuários, saques, anúncios |
| `support` | Tickets de suporte, visualização de usuários |
| `analyst` | Apenas visualização de relatórios |

**12 permissões:** `VIEW_USERS`, `MANAGE_USERS`, `VIEW_REPORTS`, `MANAGE_WITHDRAWALS`, `MANAGE_WALLET_CONFIG`, `MANAGE_ANNOUNCEMENTS`, `MANAGE_SUPPORT`, `VIEW_AUDIT`, `VIEW_BULL_BOARD`, `MANAGE_PASS`, `MANAGE_ITEMS`, `MANAGE_STADIUMS`, `MANAGE_SOCIAL`, `VIEW_REFERRALS`

### ❌ Issues Admin

| # | Gravidade | Descrição | Arquivo |
|---|-----------|-----------|---------|
| P1 | **ALTA** | **`ADMIN_USERS` JSON com senhas plaintext** no env var. `ADMIN_ALLOW_PLAINTEXT_PASSWORDS` permite bypass até em prod | `env.ts:115-126` |
| P2 | **Média** | **Admin JWT secret fallback** em dev usa `JWT_SECRET` se `ADMIN_JWT_SECRET` não configurado | `env.ts:200-204` |
| P3 | **Média** | **2FA pode ser desabilitado** via `ADMIN_2FA_DISABLED` | `env.ts:132` |
| P4 | **Baixa** | **stadium-shop-admin.routes.ts** sem Zod parse em 3 rotas POST/PATCH | `stadium-shop-admin.routes.ts` |

---

## 7. PLUGINS DE SEGURANÇA

| Plugin | Status | Observação |
|--------|--------|------------|
| **Helmet** | ✅ | CSP + HSTS + X-Frame-Options em prod. `crossOriginEmbedderPolicy: false` |
| **CORS** | ✅ | Allowlist `CORS_ORIGINS`. Permite `!origin` (server-side) |
| **CSRF** | ✅ | Opt-in via `config.csrf: true`. Cookie `_csrf` httpOnly + signed |
| **Rate Limit** | ✅ | 100 req/min global (Redis). Key: userId ou IP |
| **JWT** | ✅ | Dual namespace. Secrets separados em prod |
| **Sentry** | ✅ | Captura 5xx |

### ❌ Issues Plugins

| # | Gravidade | Descrição |
|---|-----------|-----------|
| S1 | **Média** | CSP desabilitado em dev (`!config.isProduction`) |
| S2 | **Média** | CORS permite `!origin` — qualquer script server-side pode chamar a API |
| S3 | **Baixa** | CSRF só em refresh/logout — rotas sensíveis novas precisam opt-in manual |

---

## 8. FILE UPLOADS

| Etapa | Proteção |
|-------|----------|
| Tipo de arquivo | `file-type` (detecta MIME real, não confia em extensão) |
| Sanitização | **Sharp** re-encodeia (remove EXIF, metadados, malware) |
| Path traversal | Bloqueia `../`, `/`, `\` no storage key |
| Tamanho | 5MB (uploads), 2MB (support) |
| Dimensões | Max 2048px |

**Conclusão:** Excelente implementação. Uma das melhores práticas de segurança para upload.

---

## 9. PVP & SOCKET.IO

| Aspecto | Status |
|---------|--------|
| JWT Auth no handshake | ✅ |
| Rate limit (30 evt/s) | ✅ via Redis |
| Matchmaking (fila Redis) | ✅ LPUSH/LPOP |
| Stamina validation | ✅ Antes do match |
| Anti-spam no queue | ❌ **Ausente** |

### ❌ Issues PvP

| # | Gravidade | Descrição |
|---|-----------|-----------|
| V1 | **Média** | Sem rate limit por usuário no `PVP_QUEUE` — pode floodar a fila |
| V2 | **Informativo** | Sem matching por rating/overwall |

---

## 10. WORKERS (BullMQ)

| Worker | Segurança | Risco |
|--------|-----------|-------|
| Email | ✅ Apenas envia | Baixo |
| Chain Indexer | ✅ Processa eventos on-chain | Baixo |
| Stamina Recovery | ✅ Só atualiza DB | Baixo |
| Mining Block | Distribui USDC proporcional | **Médio** |
| Vault Scanner | Escaneia Transfer events | Baixo |
| Referral Rewards | Crédito 5% GMT | Baixo |

---

## 11. INFRAESTRUTURA

### Docker
- Multi-stage builds ✅
- Non-root user (`appuser`) ✅
- Porta 3001 interna, 4100 externa (nginx) ✅
- Prisma migrate deploy no startup ✅

### Nginx
- Security headers: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection ✅
- SPA fallback (try_files) ✅
- Static assets cache 1 ano ✅
- index.html sem cache ✅
- Proxy reverso para API + Socket.IO ✅
- **Version disclosure:** nginx 1.30.0/1.31.1 exposto ❌

### Rede
- API exposta via HTTP (`:4100`) ❌
- Cloudflare protege contra DDoS ✅
- SSL válido (Google Trust Services) ✅
- HSTS configurado ✅

---

## 12. TESTES

| Módulo | Tests Unitários | Tests Integração | Cobertura |
|--------|----------------|-----------------|-----------|
| API | ~55 files | 3 (smoke + auth + club) | Exclui plugins, routes, repositories |
| Shared | 7 files | — | Schemas + economy |
| Logging | 4 files | — | Mongo sink |
| Worker | Unit + integration | — | Email + workers |
| Contracts | 2/9 contratos | — | MGTToken + USDCVault |

---

## 13. MATRIZ DE RISCO

```
CRÍTICAS (2)
├── W1: OPERATOR_PRIVATE_KEY em env var
└── E1/E2: Math.random() em economia do jogo (pass + social)

ALTAS (3)
├── W2: Withdraw approve não atômico
├── P1: Admin plaintext passwords
└── F1/F4: Swap sem validação na rota

MÉDIAS (7)
├── A1/E5: Math.random() em referral code + merge + items
├── E3/E4: Math.random() em item template + merge overwall
├── V1: PvP sem anti-spam
├── P2: Admin JWT fallback em dev
├── S1: CSP desabilitado em dev
├── S2: CORS !origin
└── F2: Pass premium sem validação

BAIXAS (5)
├── F3: Announcement dismiss type cast
├── W4: Perda precisão Decimal→Number
├── P3: 2FA pode ser desabilitado
├── S3: CSRF opt-in
└── A4: bcrypt 72 bytes limit
```

---

## 14. PLANO DE AÇÃO

### 🔴 Imediato (próximo sprint)

| # | Ação | Esforço |
|---|------|---------|
| 1 | Mover `OPERATOR_PRIVATE_KEY` para HSM/Vault externo | Alto |
| 2 | Substituir `Math.random()` por `secureRandom()` em pass, social, game, items, auth | Baixo |
| 3 | Tornar withdraw approve atômico (DB + chain em transação) | Médio |
| 4 | Adicionar `swapGmtSchema.parse()` na rota wallet | Baixo |
| 5 | Remover `ADMIN_ALLOW_PLAINTEXT_PASSWORDS` em produção | Baixo |

### 🟡 Curto prazo

| # | Ação | Esforço |
|---|------|---------|
| 6 | Adicionar rate limit por usuário no PvP queue | Baixo |
| 7 | Validar body de `POST /api/pass/premium` | Baixo |
| 8 | Substituir type casts `as` por Zod.parse em meta fields | Médio |
| 9 | Forçar HTTPS no redirect da API (`:4100`) | Médio |
| 10 | Habilitar CSP em todos ambientes não-test | Baixo |

### 🟢 Médio prazo

| # | Ação | Esforço |
|---|------|---------|
| 11 | Escrever testes para contratos faltantes (7/9) | Alto |
| 12 | Adicionar `--auth` no MongoDB Docker | Baixo |
| 13 | Remover `PRISMA_GUARD_DISABLED` bypass | Baixo |
| 14 | Adicionar rate limit nginx para WebSocket | Baixo |
| 15 | Implementar secrets management (Docker secrets / Vault) | Alto |

---

## 15. ENDPOINTS COMPLETOS

### Públicos (8)
```
GET  /health
GET  /stats/public
GET  /stats/public/wallet-activity
GET  /stats/ranking/clubs
GET  /stats/ranking/clubs/:clubName
GET  /stats/ranking/players
GET  /stats/social/videos
GET  /auth/csrf
```

### Auth (13)
```
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
POST /auth/change-password
POST /auth/change-username
GET  /auth/wallet/challenge
POST /auth/wallet/link
DELETE /auth/wallet/link
POST /auth/forgot-password
POST /auth/reset-password
POST /auth/verify-email
```

### Game API (~40)
```
/api/club/*           (5 endpoints)
/api/ct/              (1)
/api/office/*         (3)
/api/stadium/*        (2)
/api/stadium/shop/*   (2)
/api/vestiario/*      (3)
/api/minigames/*      (4)
/api/marketplace/*    (6)
/api/pvp/match        (1 — 501)
/api/pass/*           (3)
/api/referrals/stats  (1)
/api/scout/*          (2)
/api/merger/*         (2)
/api/wallet/*         (7)
/api/mining/*         (3)
/api/announcements/*  (2)
/api/support/*        (5)
/api/social/*         (4)
```

### Admin (~40)
```
/admin/api/login, verify-2fa, refresh, logout, me
/admin/api/overview, logs, security, users, reports
/admin/api/withdrawals, wallet-config, announcements
/admin/api/pass, support, referrals, audit-logs, social
/admin/api/items, stadiums, stadium-shop, vestiario-template, office-staff
```

### WebSocket Events
```
PVP_QUEUE → PVP_MATCHED | PVP_ERROR
```

---

## 16. ESTRUTURA DO PROJETO

```
master-legends-league/
├── apps/
│   ├── api/              # Fastify 5 API (~80 endpoints)
│   ├── web/              # React 19 + Vite + Tailwind
│   ├── contracts/        # Solidity (9 contratos)
│   └── worker/           # BullMQ (7 workers)
├── packages/
│   ├── shared/           # Zod schemas, types, economia
│   └── logging/          # Pino + MongoDB sink
├── docker-compose*.yml
├── nginx/
└── prisma/               # 31 models, 24 migrations
```

---

*Relatório gerado em 2026-06-13. Todas as descobertas devem ser verificadas antes da implementação em produção.*
