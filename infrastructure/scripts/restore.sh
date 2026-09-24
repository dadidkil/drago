#!/usr/bin/env bash
# Восстановление БД (и опционально файлов) из бэкапа.
#   bash infrastructure/scripts/restore.sh /srv/drago/backups/daily/db-YYYYmmdd-HHMM.dump [uploads-....tar.gz]
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd); cd "$ROOT"
DUMP=${1:?Укажите файл дампа}; FILES=${2:-}
set -a; . ./.env; set +a
COMPOSE=(docker compose --project-directory infrastructure -f infrastructure/docker-compose.yml --env-file .env)
[ "${REVERSE_PROXY:-caddy}" = "ispmanager" ] && COMPOSE+=(-f infrastructure/ispmanager/docker-compose.ispmanager.yml)
echo "⚠ Текущая база ${POSTGRES_DB} будет ЗАМЕНЕНА данными из $DUMP."
read -r -p "Введите 'восстановить' для продолжения: " ok; [ "$ok" = "восстановить" ] || exit 1
"${COMPOSE[@]}" stop web worker telegram-bot vk-bot
"${COMPOSE[@]}" exec -T backup /bin/sh /backup/backup.sh once   # страховочная копия текущего состояния
"${COMPOSE[@]}" exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB"_restore_old; psql -U "$POSTGRES_USER" -d postgres -c "ALTER DATABASE \"$POSTGRES_DB\" RENAME TO \"${POSTGRES_DB}_restore_old\";" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
"${COMPOSE[@]}" exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner < "$DUMP"
if [ -n "$FILES" ]; then
  mv "${DATA_DIR:-/srv/drago}/uploads" "${DATA_DIR:-/srv/drago}/uploads.old-$(date +%s)"
  mkdir -p "${DATA_DIR:-/srv/drago}/uploads" && tar -xzf "$FILES" -C "${DATA_DIR:-/srv/drago}/uploads" && chown -R 1000:1000 "${DATA_DIR:-/srv/drago}/uploads"
fi
"${COMPOSE[@]}" up -d
echo "✅ Восстановлено. Старая база сохранена как ${POSTGRES_DB}_restore_old (удалите после проверки)."
