# Tokenomics — Fase 1 (USDC off-chain)

Economia do MVP antes do TGE on-chain pleno. Valores de jogo (scout, farm, marketplace, passe) são **USDC no ledger Postgres**, custodiados via vault on-chain quando configurado.

## Entradas (sources)

| Fluxo | Valor | Onde |
|-------|-------|------|
| Criação de clube | +1500 USDC | `STARTER_USDC` em [`game.ts`](../../apps/api/src/config/game.ts) |
| Farm idle | `sumTop11(overwall) × (1 + (stadiumLvl−1)×0.05) × 0.000001` USDC/hora | Worker `farm-mgt` a cada 15 min |
| Venda no marketplace | preço − taxa 2% | `POST /api/marketplace/buy/:id` |
| Recompensas do passe | por nível (USDC ou jogador) | `POST /api/pass/claim/:level` |
| Depósito on-chain | USDC → vault | `USDCPlayerVault.deposit` + indexer |

## Saídas (sinks)

| Fluxo | Valor | Onde |
|-------|-------|------|
| Scout (mint) | −2 USDC × quantidade | `POST /api/scout/mint` |
| Upgrade de edifício | `100 × 1.5^level` USDC | `POST /api/club/upgrade/:building` |
| Taxa marketplace | 2% do preço (queimada off-chain) | Compra no marketplace |
| Passe premium | 500 USDC | `POST /api/pass/premium` |
| Saque on-chain | USDC ← vault | `USDCPlayerVault.withdraw` + indexer |

## Farm idle

Fórmula (dev-spec §5.3):

```
usdcPorHora = sumTop11Overwall(jogadores) × fatorEstadio × 0.000001
fatorEstadio = 1 + (stadiumLvl - 1) × 0.05
```

- Considera os **11 maiores overwalls** do elenco off-chain (`BasePlayer`).
- Máximo **24h** acumulável offline por ciclo.
- Worker credita saldo e atualiza `Club.lastFarmAt`.

## Passe de temporada

- Temporada ativa: 90 dias (seed).
- XP por ação: scout +150, compra marketplace +120, venda +80.
- 10 níveis — ver [`pass.ts`](../../apps/api/src/config/pass.ts).
- Premium: 500 USDC (desbloqueia trilha premium futura; MVP marca flag `premium`).

## Marketplace off-chain

- Ativo negociável: `BasePlayer` (não-NFT).
- Preço em USDC; taxa 2% retida do vendedor.
- Listings on-chain (`tokenId`) permanecem no seed demo para compatibilidade.

## Nota sobre MGT

O token **MGT (Master Goal Token)** permanece no roadmap de contratos para fases futuras (TGE, staking on-chain). Na Fase 1 atual, **toda economia jogável usa USDC**.

## Fora do escopo Fase 1

- Staking on-chain (`StakingVault`) com MGT
- Emissão mensal `RewardsPool` / TGE MGT
- Bridge token MGT
