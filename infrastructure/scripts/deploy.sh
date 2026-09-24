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
# Весь вывод дублируется в лог: при обрыве SSH результат не потеряется.
LOG_DIR=${DEPLOY_LOG_DIR:-/var/log/drago}
mkdir -p "$LOG_DIR" 2>/dev/null || LOG_DIR=/tmp
LOG="$LOG_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1
echo "▶ Лог: $LOG"
if [ -z "${TMUX:-}" ] && [ -z "${STY:-}" ] && [ -t 0 ]; then
  echo "⚠ Вы не в tmux/screen: при обрыве SSH деплой прервётся. Рекомендуется: tmux new -s deploy, затем make deploy."
  echo "  Продолжаю через 10 секунд (Ctrl+C — отмена)…"
  sleep 10
fi

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

echo "▶ Проверка ресурсов"
DOCKER_ROOT=$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || echo /var/lib/docker)
FREE_GB=$(df -BG --output=avail "$DOCKER_ROOT" 2>/dev/null | tail -1 | tr -dc '0-9')
MEM_MB=$(awk '/MemAvailable/{m=$2} /SwapFree/{s=$2} END{print int((m+s)/1024)}' /proc/meminfo)
echo "  свободно на диске ($DOCKER_ROOT): ${FREE_GB:-?} ГБ; память+swap доступно: ${MEM_MB} МБ"
if [ -n "$FREE_GB" ] && [ "$FREE_GB" -lt 6 ] && [ "${FORCE:-0}" != "1" ]; then
  echo "❌ Меньше 6 ГБ свободного места — сборка может заполнить диск и уронить сервер."
  echo "   Освободите место (docker system df; docker builder prune -f; docker image prune -f) или FORCE=1 make deploy"
  exit 1
fi
if [ "$MEM_MB" -lt 1500 ] && [ "${FORCE:-0}" != "1" ]; then
  echo "❌ Доступно меньше 1,5 ГБ памяти (RAM+swap) — сборка Next.js может вызвать OOM."
  echo "   Добавьте swap: sudo bash infrastructure/scripts/02-bootstrap.sh (создаёт 2 ГБ) или FORCE=1 make deploy"
  exit 1
fi

echo "▶ Сборка образов"
"${COMPOSE[@]}" --profile tools build --pull

echo "▶ База данных"
"${COMPOSE[@]}" up -d postgres redis
if [ "${SKIP_BACKUP:-0}" != "1" ] && [ -n "$("${COMPOSE[@]}" ps -q --status running backup 2>/dev/null)" ]; then
  echo "▶ Бэкап перед миграциями"
  "${COMPOSE[@]}" exec -T backup /bin/sh /backup/backup.sh once || echo "⚠ бэкап не выполнен"
else
  echo "▶ Бэкап перед миграциями пропущен (первый запуск — сервис backup ещё не работает)"
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
docker builder prune -f --filter until=168h >/dev/null 2>&1 || true
echo "▶ Готово. Лог: $LOG"
