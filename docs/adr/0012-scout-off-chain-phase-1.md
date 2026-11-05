# ADR-0012: Scout off-chain na fase 1

## Status

Aceito

## Contexto

O monorepo possui dois caminhos de scout:

1. **On-chain** — `ScoutEngine.sol` (Chainlink VRF + USDC) deployável via Hardhat
2. **Off-chain** — `POST /api/scout/mint` debita MGT server-side e cria `BasePlayer` no PostgreSQL

O frontend (ADR-0005) não usa Web3 na fase 1. O fluxo ativo no MVP é off-chain.

## Decisão

- **Fase 1:** scout exclusivamente via API (`scout.service.ts`). Mint server-authoritative com custo `SCOUT_COST_MGT`.
- **Fase 2+:** integrar `ScoutEngine` on-chain quando Wagmi/viem estiver no web e contratos estiverem deployados em Amoy/Polygon.
- Contratos `ScoutEngine`, `StakingVault` e `RewardsPool` permanecem no repositório mas **não** entram no `deploy.cjs` principal até a fase 2.

## Consequências

- `CONTRACT_SCOUT` no `.env` é opcional e ignorado pelo listener na fase 1.
- Eventos on-chain de mint continuam indexados via `PlayerMinted` quando NFTs forem mintados fora do scout off-chain.
- Documentação e README devem referenciar scout via API, não via contrato.

## Referências

- ADR-0005 (Web3 desligado fase 1)
- `apps/api/src/modules/scout/`
- `apps/contracts/contracts/ScoutEngine.sol`
