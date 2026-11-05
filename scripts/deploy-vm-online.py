#!/usr/bin/env python3
"""Deploy MLL to VM 177.7.47.139 (masterlegends.online)."""
from __future__ import annotations

import io
import os
import secrets
import subprocess
import sys
import tarfile
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = "177.7.47.139"
SSH_PORT = 2222
USER = "root"
PASSWORD = "VortexA9#Lumi"
REMOTE_DIR = "/opt/mll"
NGINX_SITE = "/root/minestation/app_production/nginx/conf.d/masterlegends.online.conf"
CERTBOT_DIR = "/root/minestation/app_production"
COMPOSE = (
    "docker compose -f docker-compose.yml "
    "-f docker-compose.vm-infra.yml "
    "-f docker-compose.vm-online.yml"
)

EXCLUDES = {
    "node_modules",
    ".git",
    "coverage",
    ".cursor",
    "dist_uploads",
    "e2e/test-results",
    ".husky",
    ".env",
    ".env.local",
    ".env.production",
    # Conteúdo de produção (fotos de jogador, anexos de suporte), não código — nunca deixar
    # o tarball local sobrescrever com uma cópia desatualizada/vazia da máquina do dev.
    "uploads",
    "private-uploads",
}


def connect() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=SSH_PORT, username=USER, password=PASSWORD, timeout=60)
    return client


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    print(f"\n$ {cmd}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode()
    err = stderr.read().decode()
    code = stdout.channel.recv_exit_status()
    if out:
        print(out.rstrip())
    if err:
        print(err.rstrip(), file=sys.stderr)
    return code, out, err


def make_tarball() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for path in ROOT.rglob("*"):
            rel = path.relative_to(ROOT).as_posix()
            if not rel or any(part in EXCLUDES for part in path.parts):
                continue
            if path.is_file():
                tar.add(path, arcname=rel)
    buf.seek(0)
    return buf.read()


def upload_project(client: paramiko.SSHClient, data: bytes) -> None:
    run(client, f"mkdir -p {REMOTE_DIR}")
    remote_tar = f"{REMOTE_DIR}/mll-deploy.tar.gz"
    chunk = 256 * 1024
    last_err: Exception | None = None
    for attempt in range(1, 5):
        try:
            sftp = client.open_sftp()
            with sftp.file(remote_tar, "wb") as f:
                f.set_pipelined(True)
                view = memoryview(data)
                for i in range(0, len(view), chunk):
                    f.write(view[i:i + chunk])
            sftp.close()
            break
        except Exception as exc:
            last_err = exc
            print(f"upload attempt {attempt} failed: {exc!r} — retrying", file=sys.stderr)
            try:
                sftp.close()
            except Exception:
                pass
            time.sleep(3 * attempt)
    else:
        raise RuntimeError(f"sftp upload failed after retries: {last_err!r}")
    run(
        client,
        f"cd {REMOTE_DIR} && tar xzf mll-deploy.tar.gz && rm mll-deploy.tar.gz",
        timeout=300,
    )


def ensure_env(client: paramiko.SSHClient) -> None:
    script = f"""set -e
cd {REMOTE_DIR}
mkdir -p apps/api/uploads/items apps/api/private-uploads
chown -R 1001:1001 apps/api/uploads apps/api/private-uploads
if [ ! -f .env ]; then
  cat > .env <<EOF
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_JWT_SECRET=$(openssl rand -hex 32)
COOKIE_SECRET=$(openssl rand -hex 32)
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
ADMIN_ALLOW_PLAINTEXT_PASSWORDS=true
ADMIN_2FA_DISABLED=true
ADMIN_USERS=[{{"id":"admin-main","login":"admin","password":"MllAdmin2026","email":"admin@mll.local","role":"super"}}]
CONTRACT_USDC_VAULT=0x967659a8Fe5C15728eD900eF9a90c44bE20190f3
USDC_ADDRESS=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
CHAIN_ID=137
EOF
  echo "Created new .env"
else
  echo "Keeping existing .env"
fi
"""
    run(client, script)


def patch_env_treasury(client: paramiko.SSHClient) -> None:
    """Ensure Polygon USDC treasury is set (not placeholder 0x...)."""
    script = f"""set -e
cd {REMOTE_DIR}
if [ -f .env ]; then
  sed -i 's|^CONTRACT_USDC_VAULT=0x\\.\\.\\.|CONTRACT_USDC_VAULT=0x967659a8Fe5C15728eD900eF9a90c44bE20190f3|' .env || true
  grep -q '^CONTRACT_USDC_VAULT=' .env || echo 'CONTRACT_USDC_VAULT=0x967659a8Fe5C15728eD900eF9a90c44bE20190f3' >> .env
  grep -q '^USDC_ADDRESS=' .env || echo 'USDC_ADDRESS=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' >> .env
  grep -q '^CHAIN_ID=' .env || echo 'CHAIN_ID=137' >> .env
  grep -q '^POLYGON_RPC_URL=' .env || echo 'POLYGON_RPC_URL=https://polygon-bor-rpc.publicnode.com' >> .env
fi
"""
    run(client, script)


def patch_env_smtp(client: paramiko.SSHClient) -> None:
    """Configure Hostinger SMTP for password reset emails."""
    script = f"""python3 <<'PY'
from pathlib import Path

env_path = Path("{REMOTE_DIR}/.env")
if not env_path.exists():
    print("No .env — skip SMTP patch")
    raise SystemExit(0)

updates = {{
    "SMTP_HOST": "smtp.hostinger.com",
    "SMTP_PORT": "465",
    "SMTP_SECURE": "true",
    "SMTP_USER": "no-reply@masterlegends.online",
    "SMTP_PASS": "$$?npX:Z>.D6V5\\;",
    "SMTP_FROM": "Master Legends League <no-reply@masterlegends.online>",
}}

lines = env_path.read_text(encoding="utf-8").splitlines()
keys = set(updates)
kept = [ln for ln in lines if not any(ln.startswith(f"{{k}}=") for k in keys)]
for key, value in updates.items():
    kept.append(f"{{key}}={{value}}")
env_path.write_text("\\n".join(kept) + "\\n", encoding="utf-8")
print("SMTP configured for no-reply@masterlegends.online")
PY"""
    run(client, script)


def deploy_stack(client: paramiko.SSHClient) -> None:
    run(client, f"cd {REMOTE_DIR} && {COMPOSE} build web api worker", timeout=1800)
    run(client, f"cd {REMOTE_DIR} && {COMPOSE} up -d postgres redis mongo-logs", timeout=300)
    time.sleep(8)
    run(client, f"cd {REMOTE_DIR} && {COMPOSE} up -d api", timeout=600)
    # Resolve any failed migrations before deploying
    failed_migrations = [
        "20260624120000_blog_post",
        "20260625000000_referral_nft_museum",
        "20260625200000_referral_gift_nft_config",
        "20260625210000_allocation_json",
        "20260626000000_social_reward_nft_config",
    ]
    for m in failed_migrations:
        run(client, f"cd {REMOTE_DIR} && {COMPOSE} exec -T api npx prisma migrate resolve --applied {m} 2>/dev/null || true", timeout=60)
    run(client, f"cd {REMOTE_DIR} && {COMPOSE} exec -T api npx prisma migrate deploy", timeout=300)
    run(client, f"cd {REMOTE_DIR} && {COMPOSE} up -d worker web", timeout=600)
    code, out, _ = run(client, "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/health || echo fail")
    print(f"Health on :4000 => {out.strip()}")


def setup_nginx_ssl(client: paramiko.SSHClient) -> None:
    local_conf = ROOT / "scripts/nginx-vm-sites/masterlegends.online.conf"

    # If LE cert already exists, install full HTTPS vhost immediately (avoid default vhost cert).
    code, out, _ = run(
        client,
        "docker exec app_nginx test -f /etc/letsencrypt/live/masterlegends.online/fullchain.pem "
        "&& echo CERT_OK || echo CERT_MISSING",
    )
    cert_exists = "CERT_OK" in out

    if cert_exists:
        print("==> LE cert exists — installing full HTTPS vhost")
        sftp = client.open_sftp()
        sftp.put(str(local_conf), NGINX_SITE)
        sftp.close()
        run(client, "docker exec app_nginx nginx -t")
        run(client, "docker exec app_nginx nginx -s reload")
        return

    # HTTP-only config for initial ACME issuance (no SSL lines yet)
    http_only = """server {
    listen 80;
    listen [::]:80;
    server_name masterlegends.online www.masterlegends.online;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    include /etc/nginx/conf.d/sensitive-deny.inc;

    location / {
        proxy_pass http://172.20.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
"""
    run(client, f"cat > {NGINX_SITE} <<'NGINXEOF'\n{http_only}\nNGINXEOF")
    run(client, "docker exec app_nginx nginx -t")
    run(client, "docker exec app_nginx nginx -s reload")

    cert_cmd = (
        f"cd {CERTBOT_DIR} && docker compose run --rm app_certbot certbot certonly "
        "--webroot -w /var/www/certbot "
        "-d masterlegends.online -d www.masterlegends.online "
        "--email admin@masterlegends.online --agree-tos --no-eff-email --non-interactive"
    )
    code, out, err = run(client, cert_cmd, timeout=900)
    if code != 0 and "Certificate not yet due for renewal" not in out + err:
        print("WARN: certbot may have failed; will still install HTTPS vhost if cert exists")

    # Always install full HTTPS config after certbot (even on timeout — cert may already exist)
    sftp = client.open_sftp()
    sftp.put(str(local_conf), NGINX_SITE)
    sftp.close()
    run(client, "docker exec app_nginx nginx -t")
    run(client, "docker exec app_nginx nginx -s reload")


def verify(client: paramiko.SSHClient) -> None:
    run(client, f"cd {REMOTE_DIR} && {COMPOSE} ps")
    run(client, "curl -sI http://127.0.0.1:4000/ | head -5")
    run(client, "curl -sI https://masterlegends.online/ -k | head -8 || curl -sI http://masterlegends.online/ | head -8")
    run(client, "docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'")


def build_web_assets() -> None:
    print("==> Building shared packages...")
    subprocess.run(
        ["npm", "run", "build:shared"],
        cwd=ROOT,
        check=True,
    )
    print("==> Building API (apps/api/dist)...")
    subprocess.run(
        ["npm", "run", "build:api"],
        cwd=ROOT,
        check=True,
    )
    print("==> Building worker (apps/worker/dist)...")
    subprocess.run(
        ["npm", "run", "build:worker"],
        cwd=ROOT,
        check=True,
    )
    print("==> Building web assets (apps/web/dist)...")
    subprocess.run(
        ["npm", "run", "build:web"],
        cwd=ROOT,
        check=True,
    )


def main() -> None:
    build_web_assets()
    print("==> Building tarball...")
    data = make_tarball()
    print(f"    {len(data) / 1024 / 1024:.1f} MB")

    client = connect()
    try:
        print("==> Uploading project...")
        upload_project(client, data)
        print("==> Ensuring .env...")
        ensure_env(client)
        patch_env_treasury(client)
        patch_env_smtp(client)
        print("==> Deploying Docker stack...")
        deploy_stack(client)
        print("==> Configuring nginx + SSL...")
        setup_nginx_ssl(client)
        print("==> Verification...")
        verify(client)
        print("\n✅ Deploy complete: https://masterlegends.online (port 4000 on host)")
    finally:
        client.close()


if __name__ == "__main__":
    main()
