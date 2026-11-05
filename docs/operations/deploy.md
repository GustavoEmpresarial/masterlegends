# Deploy (VM demo)

Deploy manual para a VM compartilhada (`84.54.23.199:8000`). Use sempre o script [`scripts/deploy-vm.sh`](../../scripts/deploy-vm.sh) — **nunca** `rsync --delete` solto sem proteger o `.env`.

## Regra de ouro: secrets estáveis

`JWT_SECRET`, `ADMIN_JWT_SECRET` e `COOKIE_SECRET` em `/opt/mll/.env` assinam refresh tokens e cookies CSRF. Se esses valores mudam, **todos os usuários são deslogados**.

| Ação | Efeito nas sessões |
|------|-------------------|
| Deploy só do `web` | Usuário continua logado após reload (refresh cookie intacto) |
| Recriar `api` com mesmo `.env` | Sessões persistem (Redis mantém estado `rt:jti:*`) |
| Apagar/regenerar `.env` | Logout em massa |
| `docker compose down -v` | Apaga volumes Redis/Postgres — sessões e dados perdidos |

O script faz backup automático: `/opt/mll/.env.bak` antes de cada deploy.

## Build do front na VM (FileZilla + SSH)

A VM tem Node 18 no host — **não use** `npm run build` direto no shell. Use o script que builda com **Node 20 via Docker**:

```bash
cd /opt/mll
chmod +x scripts/build-web-on-vm.sh

# primeira vez ou se npm install quebrou — apaga node_modules
./scripts/build-web-on-vm.sh --clean
```

Suba só **source** (`apps/web/src`, `packages/shared`, `scripts/`) — **não** suba `node_modules` do Windows.

O script: `npm install` → build `shared` + `web` → `docker compose build --no-cache web` → `up -d web`.

## Pré-requisito: build local (opcional)

```bash
npm run build -w @mll/shared -w @mll/web -w @mll/api -w @mll/worker
```

## Targets

```bash
chmod +x scripts/deploy-vm.sh

# Só frontend (layout, i18n, UI) — não reinicia API
./scripts/deploy-vm.sh web

# Só backend (rotas, migrations, lógica)
./scripts/deploy-vm.sh api

# Projeto completo (código + docker files)
./scripts/deploy-vm.sh full

# Verificar que .env existe e volume Redis
./scripts/deploy-vm.sh verify
```

Variáveis opcionais:

- `MLL_VM_HOST` — default `root@84.54.23.199`
- `MLL_VM_DIR` — default `/opt/mll`

## Compose na VM

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.vm-infra.yml \
  -f docker-compose.vm.yml \
  up -d
```

- **Web** exposta na porta `8000`
- **API** só na rede Docker (proxy nginx no container web)
- Runtime images: `docker/Dockerfile.web-runtime`, `docker/Dockerfile.api-runtime`

## Primeira instalação do `.env` na VM

Crie **uma vez** e guarde backup offline:

```bash
ssh root@84.54.23.199
cd /opt/mll
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # ADMIN_JWT_SECRET
openssl rand -hex 32   # COOKIE_SECRET
# Edite .env manualmente — nunca regenere em deploys rotineiros
chmod 600 .env
cp .env .env.bak
```

## Rollback

1. Restaurar `.env`: `cp /opt/mll/.env.bak /opt/mll/.env`
2. Re-deploy do commit anterior: `./scripts/deploy-vm.sh full`
3. Se migrations falharem, inspecionar `docker compose ... logs api`

## Checklist pós-deploy

1. `curl -s -o /dev/null -w '%{http_code}' http://84.54.23.199:8000/` → `200`
2. Login + hard refresh → continua autenticado
3. `md5sum /opt/mll/.env` antes e depois do deploy → **mesmo hash**

## O que evitar

- `rsync --delete` sem `--filter='protect .env'`
- `--force-recreate api` em deploys só de front
- Regenerar secrets “por segurança” a cada release
- `docker compose down -v` em produção/demo
