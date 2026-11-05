# @mll/contracts

Smart contracts Solidity — Polygon / Amoy.

Documentação: [`docs/architecture/contracts.md`](../../docs/architecture/contracts.md).

---

## Quick start

```bash
# Node Hardhat local (watch)
npm run dev:contracts

# Compilar
npm run build -w @mll/contracts

# Testes
npm test -w @mll/contracts
```

---

## Deploy

| Comando | Rede |
|---------|------|
| `npm run deploy:local -w @mll/contracts` | Hardhat (31337) |
| `npm run deploy:amoy -w @mll/contracts` | Polygon Amoy (80002) |
| `npm run deploy:polygon -w @mll/contracts` | Polygon (137) |

Após deploy:

```bash
npm run sync:contracts:env hardhat   # ou amoy / polygon
```

Sincroniza `CONTRACT_*` no `.env` raiz.

---

## Contratos

`contracts/` — 9 contratos (MGTToken, MLLPlayerNFT, ScoutEngine, Marketplace, BurnEngine, StakingVault, RewardsPool, USDCPlayerVault, MockUSDC).

Solidity **0.8.26**, OpenZeppelin 5, Chainlink VRF.

---

## Env

No `.env` raiz:

- `DEPLOYER_PRIVATE_KEY`
- `ALCHEMY_API_KEY`
- `POLYGONSCAN_API_KEY` (verify)

Config: `hardhat.config.cjs`.
