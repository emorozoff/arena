#!/usr/bin/env bash
# Обновление до свежей версии из GitHub. Запускать от root на сервере: bash /opt/arena/deploy/update.sh
set -euo pipefail
git config --global --add safe.directory /opt/arena
cd /opt/arena
git pull --ff-only
npm ci --no-audit --no-fund
npm run build
chown -R arena:arena /opt/arena
cp deploy/arena.service /etc/systemd/system/arena.service
cp deploy/Caddyfile /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl restart arena
systemctl reload caddy
echo "Обновлено: $(git log --oneline -1)"
systemctl --no-pager --lines=3 status arena | head -8
