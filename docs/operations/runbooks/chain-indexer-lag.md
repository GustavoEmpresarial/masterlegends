# Runbook: Chain indexer lag

Sintoma: depósitos on-chain não refletem no saldo, NFTs mintados on-chain não aparecem no jogo.

---

## 1. Pré-requisitos

Chain indexer só funciona se configurado:

| Variável | Propósito |
|----------|-----------|
| `POLYGON_RPC_URL` ou `AMOY_RPC_URL` | RPC ativo |
| `CONTRACT_USDC_VAULT` | Endereço vault |
| `CONTRACT_PLAYER_NFT` | NFT (fase on-chain) |
| `GAME_ROLE_KEY` ou listener wallet | Chave para escutar eventos |

Sem contratos deployados: comportamento esperado na fase 1 off-chain.

---

## 2. Verificar ChainService (API)

Logs da API ao boot:

```
Chain listener started
```

Se ausente: contratos não configurados ou RPC inacessível.

```bash
docker compose logs api | grep -i chain
```

---

## 3. Fila chain-indexer

Worker processa eventos enfileirados pela API.

```bash
docker compose logs worker | grep chain-indexer
```

Jobs failed indicam:
- RPC timeout → trocar endpoint ou Alchemy
- `txHash` duplicado → idempotente, geralmente OK
- User wallet não linkada → depósito de wallet desconhecida ignorado

---

## 4. Checkpoint / reindex

O listener ethers processa blocos a partir do último checkpoint (ver implementação em `modules/chain/`).

Se lag grande após downtime prolongado:
1. Verificar RPC responde: `curl` no endpoint
2. Restart API (reinicia listener)
3. Monitorar worker processando backlog

Reindex manual completo: operação destrutiva — só com script dedicado e backup. Não documentado no MVP.

---

## 5. Depósito não creditado

Checklist:
1. Transação confirmada on-chain (Polygonscan)
2. Wallet do usuário linkada em `User.wallet`
3. `WalletTransaction` com `txHash` existe?
4. Job `chain-indexer` com evento `UsdcDeposited` completed?

Query:

```sql
SELECT * FROM "WalletTransaction" WHERE "txHash" = '<hash>';
```

---

## 6. RPC issues

Sintomas: `timeout`, `429 Too Many Requests`.

Ações:
- Usar Alchemy com API key (`ALCHEMY_API_KEY`)
- Rate limit do RPC free tier — upgrade plano
- Failover para RPC secundário em `POLYGON_RPC_URL`
