#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Деплой/обновление: git pull → сборка образов → миграции → перезапуск → проверка здоровья.
#   bash infrastructure/scripts/deploy.sh [git-ref]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
[ -f .env ] || { echo "Нет .env — выполните infrastructure/scripts/gen-secrets.sh"; exit 1; }
REF=${1:-}
set -a; . ./.env; set +a
COMPOSE=(docker compose --project-directory infrastructure -f infrastructure/docker-compose.yml --env-file .env)
# REVERSE_PROXY=ispmanager — 80/443 обслуживает nginx ISPmanager, Caddy не запускается
[ "${REVERSE_PROXY:-caddy}" = "ispmanager" ] && COMPOSE+=(-f infrastructure/ispmanager/docker-compose.ispmanager.yml)
[ "${WITH_MAIL:-0}" = "1" ] && COMPOSE+=(-f infrastructure/mail/docker-compose.mail.yml)
echo "▶ Режим: ${REVERSE_PROXY:-caddy}$( [ "${WITH_MAIL:-0}" = "1" ] && echo ' + self-hosted почта')"
mkdir -p "${DATA_DIR:-/srv/drago}/uploads" "${DATA_DIR:-/srv/drago}/backups"

if [ -n "$REF" ] || [ -d .git ]; then
  echo "▶ Обновление кода"
  git fetch --all --prune
  [ -n "$REF" ] && git checkout "$REF"
  git pull --ff-only || true
fi
echo "▶ Версия: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

echo "▶ Сборка образов"
"${COMPOSE[@]}" build --pull

echo "▶ База данных"
"${COMPOSE[@]}" up -d postgres redis
if [ "${SKIP_BACKUP:-0}" != "1" ] && "${COMPOSE[@]}" ps --status running backup >/dev/null 2>&1; then
  echo "▶ Бэкап перед миграциями"
  "${COMPOSE[@]}" exec -T backup /bin/sh /backup/backup.sh once || echo "⚠ бэкап не выполнен (первый запуск?)"
fi
"${COMPOSE[@]}" --profile tools run --rm migrate

echo "▶ Запуск сервисов"
"${COMPOSE[@]}" up -d --remove-orphans

echo "▶ Проверка здоровья"
for i in $(seq 1 30); do
  status=$("${COMPOSE[@]}" ps --format '{{.Service}}:{{.Health}}' web | cut -d: -f2)
  [ "$status" = "healthy" ] && break
  sleep 4
done
"${COMPOSE[@]}" ps
[ "$status" = "healthy" ] || { echo "❌ web не стал healthy — смотрите: make logs s=web"; exit 1; }
if [ "${REVERSE_PROXY:-caddy}" = "ispmanager" ]; then
  curl -fsS "http://127.0.0.1:${WEB_PORT:-3000}/api/health" >/dev/null && echo "✅ приложение отвечает на 127.0.0.1:${WEB_PORT:-3000}"
  curl -fsS "https://${DOMAIN}/api/health" >/dev/null && echo "✅ https://${DOMAIN} отвечает через nginx ISPmanager" \
    || echo "⚠ https://${DOMAIN} не отвечает: выполните sudo bash infrastructure/ispmanager/install-nginx-proxy.sh ${DOMAIN} и проверьте SSL сайта в ISPmanager"
else
  curl -fsS "https://${DOMAIN}/api/health" >/dev/null && echo "✅ https://${DOMAIN} отвечает" || echo "⚠ https://${DOMAIN} пока не отвечает (DNS/сертификат?)"
fi
docker image prune -f >/dev/null
