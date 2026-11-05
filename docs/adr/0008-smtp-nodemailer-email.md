# 0008 — Email via SMTP genérico (nodemailer)

- **Status**: accepted
- **Data**: 2026-06-04
- **Decisor(es)**: equipe core

## Contexto

Verificação de email e reset de senha exigem envio assíncrono. Lock-in em provedor (SendGrid, SES) atrapalha dev local e deploy flexível.

## Decisão

- **nodemailer** com transport SMTP configurável por env (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).
- Envio **nunca bloqueia** o request — enfileira em BullMQ (`email` queue), worker consome (`apps/worker/src/workers/email.worker.ts`).
- Templates HTML + texto plano com escape automático de variáveis (`modules/email/templates.ts`).
- Dev: MailHog na porta 1025 (`SMTP_HOST=localhost`, `SMTP_PORT=1025`).
- Logs estruturados hasheiam destinatário (sem PII).

## Consequências

- ✅ Funciona com qualquer SMTP (MailHog, Mailtrap, SES, Postmark).
- ✅ Retry exponencial no worker (3x).
- ⚠️ Sem tracking de deliverability nesta fase.
- ⚠️ MJML compilado em runtime simples (HTML string) — migrar para build-time se templates crescerem.
