# Threat model

Modelo de ameaças do Master Legends League. Controles detalhados em [`invariants.md`](./invariants.md).

---

## Atores

| Ator | Motivação | Capacidade |
|------|-----------|------------|
| **Jogador legítimo** | Jogar, ganhar USDC | Cliente web, API autenticada |
| **Jogador malicioso** | Explorar economia, farm bots | Manipular requests, automação |
| **Admin operador** | Operar plataforma | Painel admin, env credentials |
| **Atacante externo** | Roubar fundos, dados, DoS | Internet, sem credenciais |
| **Insider** | Abuso de privilégio | Acesso deploy, `.env`, DB |

---

## Ativos

| Ativo | Criticidade | Onde |
|-------|-------------|------|
| Saldo USDC (ledger) | **Crítica** | `MGTBalance`, transações Prisma |
| Jogadores (`BasePlayer`) | Alta | PostgreSQL |
| Refresh tokens | Alta | Redis + cookie httpOnly |
| JWT secrets | **Crítica** | `.env` |
| `DEPLOYER_PRIVATE_KEY` / `GAME_ROLE_KEY` | **Crítica** | `.env` |
| Uploads (imagens) | Média | Filesystem / Pinata |
| Dados PII (email) | Alta | `User` |
| Logs operacionais | Baixa | MongoDB (TTL) |

---

## Superfícies de ataque

```mermaid
flowchart TB
  subgraph public [Superficie_publica]
    REST[REST_API]
    WS[Socket.IO]
    Web[SPA_React]
    Uploads[/uploads]
  end

  subgraph admin [Superficie_admin]
    AdminAPI[/admin/api]
    BullBoard[Bull_Board]
  end

  subgraph chain [On_chain]
    Vault[USDCPlayerVault]
    NFT[MLLPlayerNFT]
  end

  Attacker[Atacante] --> REST
  Attacker --> WS
  Attacker --> Web
  Attacker --> AdminAPI
```

| Superfície | Vetores | Controles |
|------------|---------|-----------|
| REST `/auth/*` | Brute force, credential stuffing | Rate limit 5/min, lockout 5 falhas, Turnstile |
| REST `/api/*` | IDOR, price manipulation | Server-authoritative, JWT guard, Zod validation |
| Socket.IO | Spoof events, flood | JWT handshake, rate limit por user |
| Uploads | Malware, XSS via imagem | sharp resize, file-type MIME, size limits |
| Admin panel | Credential theft, 2FA bypass | Env users, JWT separado, 2FA email |
| Contratos | Reentrancy, role abuse | OpenZeppelin, AccessControl, audit futuro |
| Redis | Token theft se exposto | Rede interna Docker, sem exposição pública |

---

## Ameaças e mitigações

### T1 — Manipulação econômica (client-side)

**Ameaça:** Cliente envia preço/recompensa customizada.

**Mitigação:** Preços de `GAME_CONFIG` e services. Cliente envia apenas ação. Ver invariants §1.

### T2 — Account takeover

**Ameaça:** Roubo de refresh token ou JWT.

**Mitigação:** Refresh httpOnly + rotação com detecção de reuso. Access token curto (15m). CSRF em rotas com cookie.

### T3 — IDOR (acesso a dados de outro usuário)

**Ameaça:** Manipular `userId` no body.

**Mitigação:** `request.user.id` do JWT apenas. Guards globais em `/api/*`.

### T4 — SQL injection

**Ameaça:** Input malicioso em queries.

**Mitigação:** Prisma parametrizado. Proibido `$queryRaw` com concatenação.

### T5 — DoS

**Ameaça:** Flood de requests.

**Mitigação:** Rate limit global 100/min + limites por rota sensível. Redis store.

### T6 — Bot farming

**Ameaça:** Registro/login automatizado.

**Mitigação:** Cloudflare Turnstile (obrigatório em prod). Rate limit auth.

### T7 — Admin compromise

**Ameaça:** Credencial admin vazada.

**Mitigação:** 2FA email, JWT admin separado, contas só via env (sem registro público). Bcrypt em prod.

### T8 — Upload malicioso

**Ameaça:** Polyglot file, oversized image.

**Mitigação:** `file-type` + `sharp` re-encode. Limites de tamanho.

### T9 — Chain replay / double credit

**Ameaça:** Reprocessar depósito on-chain ou submeter hash de transação alheia.

**Mitigação:** `WalletTransaction.txHash` unique; upsert idempotente no worker; `DepositClaim.txHash` unique; verificação on-chain (Polygonscan/RPC) do remetente, treasury e valor mínimo; rejeição de txs > 30 dias; rate limit de claims (5/h por usuário); recheck automático a cada 10 min para claims pendentes; audit log `deposit_claim_*`.

### T10 — Secrets em repositório

**Ameaça:** `.env` commitado.

**Mitigação:** `.gitignore`, review PR, secrets em CI/CD. Nunca plaintext admin password em prod.

---

## Trust boundaries

| Boundary | Confia em | Não confia em |
|----------|-----------|---------------|
| API → Cliente | Nada do body para identidade/preço | Headers/body de userId, amounts |
| Worker → DB | Próprio código | Input de jobs sem validação |
| Chain listener → Worker | Eventos do contrato verificado | RPC não autenticado (validar endereços) |
| Web → API | Response DTOs | Dados sensíveis em localStorage |

---

## Residual risks (fase 1)

- Web3 auth desabilitado mas rotas existem — retornam 501
- Admin passwords plaintext permitidos em dev (`ADMIN_ALLOW_PLAINTEXT_PASSWORDS`)
- Sem WAF dedicado além de Turnstile + rate limit
- Contratos não auditados formalmente no MVP
- Responsible disclosure: ver [`responsible-disclosure.md`](./responsible-disclosure.md)

---

## Referências

- [`invariants.md`](./invariants.md) — regras não-negociáveis
- ADRs de segurança: [0005](../adr/0005-disable-web3-auth-phase-1.md), [0006](../adr/0006-refresh-token-rotation-redis.md), [0009](../adr/0009-csrf-cookie-routes.md), [0013](../adr/0013-env-based-admin-auth.md)
