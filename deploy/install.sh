#!/usr/bin/env bash
# Первичная установка на чистый Ubuntu (22.04+). Запускать от root: bash install.sh
# Ставит Node 24, Caddy (HTTPS), клонирует проект в /opt/arena, создаёт пользователя arena и службу автозапуска.
set -euo pipefail

REPO="https://github.com/emorozoff/arena.git"
APP_DIR="/opt/arena"

echo "== Пакеты =="
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q curl git ca-certificates gnupg build-essential python3 debian-keyring debian-archive-keyring apt-transport-https

echo "== Node 24 =="
if ! command -v node >/dev/null || [[ "$(node -v)" != v24* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y -q nodejs
fi
node -v && npm -v

echo "== Caddy =="
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi
caddy version

echo "== Пользователь и код =="
id arena >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/arena --shell /usr/sbin/nologin arena
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO" "$APP_DIR"
fi
git config --global --add safe.directory "$APP_DIR"
cd "$APP_DIR"
git pull --ff-only
npm ci --no-audit --no-fund
npm run build
mkdir -p data
chown -R arena:arena "$APP_DIR"

echo "== Настройки =="
if [ ! -f "$APP_DIR/.env" ]; then
  cp .env.example .env
  chown arena:arena .env
  chmod 600 .env
  echo "!! Впишите пароль пульта в $APP_DIR/.env (ADMIN_PASSWORD) и PUBLIC_URL, затем: systemctl restart arena"
fi

echo "== Службы =="
cp deploy/arena.service /etc/systemd/system/arena.service
cp deploy/Caddyfile /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable --now arena
systemctl restart arena
systemctl enable --now caddy
systemctl reload caddy || systemctl restart caddy

echo "== Готово =="
systemctl --no-pager --lines=5 status arena | head -12
