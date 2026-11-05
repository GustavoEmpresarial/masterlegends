# 0005 — SIWE desabilitada na Fase 1

- **Status**: accepted
- **Data**: 2026-06-04
- **Decisor(es)**: equipe core

## Contexto

A rota `/api/auth/verify` herdada da versão anterior aceitava qualquer assinatura sem verificação real (`// Simplified - in production use SIWE verification`) e emitia JWT — bypass de autenticação completo. Implementar SIWE de forma segura exige verificação criptográfica + nonce TTL no Redis + EIP-4361 message parsing, o que sai do escopo da Fase 1 (segurança + reorganização).

## Decisão

**Desligar** as rotas web3 (`/auth/nonce`, `/auth/verify`) enquanto a Fase 1 está em vigor. Elas retornam `501 AUTH_WEB3_DISABLED`. Login fica apenas via email/senha. Reabilitar requer flag `ENABLE_WEB3_AUTH=true` *e* implementação real de SIWE — combinação documentada em [`../security/invariants.md`](../security/invariants.md).

## Alternativas consideradas

- **Implementar SIWE agora**: amplia escopo da fase, sem necessidade de produto (não há usuários web3 ainda).
- **Manter o handler vulnerável**: inaceitável — bypass completo.
- **Deletar as rotas**: forçaria o frontend a também remover referências; preferimos manter o endpoint como "501 explícito" para clientes legados.

## Consequências

- ✅ Bypass crítico fechado imediatamente.
- ✅ Fica claro no código (e em logs) que web3 está desligado, em vez de quietamente quebrado.
- ⚠️ Frontend que tentar usar wallet recebe 501; UX precisa esconder o botão até a Fase 2.
- 🔁 Revisitar quando entrar Fase 2 com SIWE real — abrir novo ADR superseding este.
