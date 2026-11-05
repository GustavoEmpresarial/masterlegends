# Checklist exploratório (QA manual)

Usar em smoke de release ou após mudanças grandes. Marcar o que falhar e anexar screenshot/URL.

## Auth

- [ ] Register → landing no clube / create club
- [ ] Login / logout / refresh após reload
- [ ] Email não verificado bloqueia claim de quest com `requireEmailVerified`
- [ ] Recuperação de senha (fluxo completo se SMTP de teste disponível)

## Clube / Elenco

- [ ] Inventário carrega; card abre modal de jogador
- [ ] Equipar / desequipar chuteira (se catálogo ativo) atualiza OW efetivo
- [ ] Lineup salva sem regressão de stamina

## Lojinha (estádio)

- [ ] `/club/shop` lista stamina + gear (gear pode estar vazio)
- [ ] Compra gear debita GMT e aparece na bag (`/api/club/gear`)
- [ ] Compra stamina aplica efeito no jogador escolhido

## Eventos / Quests

- [ ] Board `/eventos` lista campanhas ativas
- [ ] Progresso sobe nos triggers (login, scout, etc.)
- [ ] Claim happy path; segundo claim → 409
- [ ] Cap global esgota → 409
- [ ] Reward OVERWALL aparece como grant de evento (não check-in)
- [ ] Admin Eventos: criar/editar quest + upload imagem sanitizado

## Segurança / XSS

- [ ] Popup/avisos: link `javascript:` não vira `<a href>`
- [ ] Markdown com `"` no URL não quebra atributo
- [ ] Upload de imagem de evento/gear só aceita paths/http(s)
- [ ] JWT inválido / expirado → 401 nas rotas `/api/*`
- [ ] Player token não acessa `/admin/api/*`

## Concorrência / resiliência

- [ ] Dois claims quase simultâneos da mesma quest → um 200, outro 409
- [ ] Compra gear com saldo no limite (corrida) não deixa saldo negativo
- [ ] Navegação rápida entre club → shop → elenco sem crash
- [ ] Interromper upload a meio (cancel) não corrompe UI admin
- [ ] Simular perda de rede (DevTools offline) → erros tratados, retry/login ok

## Dados inválidos / extremos

- [ ] Payloads vazios / UUID inválido em buy/claim → 400
- [ ] Strings enormes em títulos de quest (admin) → rejeição Zod
- [ ] Valores negativos em withdraw → rejeição

## Acessibilidade / UX

- [ ] Modal de jogador fecha com botão Fechar e foco razoável
- [ ] Contraste de textos em dark mode (selects admin)
- [ ] Fluxos principais usáveis só com teclado (tab + enter) onde aplicável

## Admin

- [ ] Permissão `MANAGE_EVENTS` / shop gear
- [ ] Select dark mode legível (menus não brancos)
- [ ] Escalada: conta sem permissão não vê ações restritas

## Regressão rápida

- [ ] Scout mint
- [ ] Pass progress
- [ ] Marketplace search
- [ ] Check-in diário
- [ ] Wallet summary / withdraw request (saldo insuficiente)
