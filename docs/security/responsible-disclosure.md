# Responsible disclosure

Política de reporte de vulnerabilidades de segurança do Master Legends League.

> **Status:** rascunho pré-go-live. Atualizar o email de contato antes do lançamento público.

---

## Escopo

### In scope

- API REST (`/auth`, `/api`, `/admin/api`)
- WebSocket (Socket.IO)
- Painel admin
- Lógica econômica server-side (saldo, marketplace, scout)
- Uploads de arquivos
- Smart contracts deployados em Polygon/Amoy
- Infraestrutura sob controle direto da equipe (quando em produção)

### Out of scope

- Ataques de engenharia social contra jogadores individuais
- Denial of service em larga escala (reportar, mas sem bounty garantido)
- Vulnerabilidades em dependências já públicas sem PoC específico ao MLL
- Ambientes de terceiros (Cloudflare, Alchemy, Pinata) — reportar ao provedor
- Contas de teste / staging sem dados reais (informar mesmo assim)

---

## Como reportar

**Email:** `security@masterlegendsleague.com` *(placeholder — configurar antes do go-live)*

Inclua:
1. Descrição clara da vulnerabilidade
2. Passos para reproduzir (PoC)
3. Impacto estimado (confidencialidade, integridade, disponibilidade, financeiro)
4. Seu contato para follow-up

**Não** divulgue publicamente antes da correção acordada.

---

## SLA de resposta

| Etapa | Prazo alvo |
|-------|------------|
| Acknowledgment | 48 horas úteis |
| Triagem inicial | 5 dias úteis |
| Correção crítica (fundos em risco) | 7 dias |
| Correção alta | 30 dias |
| Correção média/baixa | próximo release |

Prazos são metas internas, não garantias legais.

---

## Severidade (guia interno)

| Nível | Exemplo |
|-------|---------|
| **Crítica** | Crédito USDC arbitrário, bypass auth admin, drain de vault |
| **Alta** | IDOR em saldo/jogadores, refresh token reuse não detectado |
| **Média** | Rate limit bypass, info leak em logs |
| **Baixa** | Headers de segurança ausentes sem exploit direto |

---

## Boas práticas para pesquisadores

- Use apenas contas e ambientes de teste que você controla
- Não acesse dados de outros usuários reais
- Não execute ações destrutivas (delete massivo, flush Redis)
- Pare imediatamente se encontrar dados PII expostos — reporte sem copiar

---

## Reconhecimento

Programa de bug bounty formal: **não ativo no MVP**. Relatórios válidos podem ser reconhecidos publicamente (com permissão) após correção.

---

## Contato alternativo

Se o email principal não responder em 72h, abra issue privada no repositório (se habilitado) ou contate o maintainer principal listado no README.
