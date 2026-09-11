#!/usr/bin/env bash
# Копия базы (итоги и лог шоу). Запускать на сервере: bash /opt/arena/deploy/backup.sh
# Файл появится в /opt/arena/backups/ — скачать на Мак: scp -i ~/.ssh/arena_beget root@СЕРВЕР:/opt/arena/backups/ФАЙЛ .
set -euo pipefail
mkdir -p /opt/arena/backups
OUT="/opt/arena/backups/arena-$(date +%Y%m%d-%H%M%S).db"
sqlite3 /opt/arena/data/arena.db ".backup '$OUT'" 2>/dev/null || cp /opt/arena/data/arena.db "$OUT"
echo "Копия базы: $OUT"
