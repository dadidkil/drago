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
free_gb() { df -BG --output=avail "$DOCKER_ROOT" 2>/dev/null | tail -1 | tr -dc '0-9'; }
FREE_GB=$(free_gb)
MEM_MB=$(awk '/MemAvailable/{m=$2} /SwapFree/{s=$2} END{print int((m+s)/1024)}' /proc/meminfo)
echo "  свободно на диске ($DOCKER_ROOT): ${FREE_GB:-?} ГБ; память+swap доступно: ${MEM_MB} МБ"
if [ -n "$FREE_GB" ] && [ "$FREE_GB" -lt 8 ]; then
  # Кэш сборки и «висячие» образы — только кэш, данные (БД, файлы, тома) не затрагиваются.
  echo "  мало места — очищаю кэш сборки Docker и неиспользуемые образы…"
  docker builder prune -af >/dev/null 2>&1 || true
  docker image prune -f >/dev/null 2>&1 || true
  FREE_GB=$(free_gb)
  echo "  после очистки свободно: ${FREE_GB:-?} ГБ"
fi
if [ -n "$FREE_GB" ] && [ "$FREE_GB" -lt 6 ] && [ "${FORCE:-0}" != "1" ]; then
  echo "❌ Меньше 6 ГБ свободного места даже после очистки кэша — сборка может заполнить диск и уронить сервер."
  echo "   Проверьте: du -xh / --max-depth=2 | sort -h | tail -20; ls -la /srv/drago/backups. Либо FORCE=1 make deploy"
  exit 1
fi
if [ "$MEM_MB" -lt 1500 ] && [ "${FORCE:-0}" != "1" ]; then
  echo "❌ Доступно меньше 1,5 ГБ памяти (RAM+swap) — сборка Next.js может вызвать OOM."
  echo "   Добавьте swap: sudo bash infrastructure/scripts/02-bootstrap.sh (создаёт 2 ГБ) или FORCE=1 make deploy"
  exit 1
fi

if [ "${REVERSE_PROXY:-caddy}" = "ispmanager" ]; then
  # web и vk-bot публикуются на 127.0.0.1. На сервере могут работать другие сайты (на этом —
  # genreless.ru на порту 3000): порт, занятый чужим процессом, не трогаем, а берём свободный
  # и записываем его в .env. Порт, который держит наш же контейнер, занятым не считается.
  echo "▶ Проверка портов"
  if command -v ss >/dev/null; then
    listener() { ss -Hltnp "sport = :$1" 2>/dev/null | head -1; }
    ours() { "${COMPOSE[@]}" port "$1" "$2" 2>/dev/null | grep -q ":$3\$"; }
    set_env() { if grep -q "^$1=" .env; then sed -i "s/^$1=.*/$1=$2/" .env; else echo "$1=$2" >> .env; fi; }
    ensure_port() { # переменная сервис порт-в-контейнере порт-по-умолчанию порт-которого-избегать
      local var=$1 svc=$2 cport=$3 def=$4 avoid=${5:-} port busy new
      port=${!var:-$def}
      [[ "$port" =~ ^[0-9]+$ ]] || { echo "❌ $var=$port — не число"; exit 1; }
      busy=$(listener "$port")
      if [ -n "$busy" ] && ! ours "$svc" "$cport" "$port"; then
        new=$def
        while [ -n "$(listener "$new")" ] || [ "$new" = "$avoid" ] || [ "$new" = "$port" ]; do new=$((new + 1)); done
        echo "  ⚠ порт $port занят другим приложением ($(awk '{print $6}' <<<"$busy")) — его не трогаем"
        echo "  $var: $port → $new (записано в .env)"
        set_env "$var" "$new"
        port=$new
      else
        echo "  $var=$port — свободен или занят «Драго»"
      fi
      printf -v "$var" '%s' "$port"; export "${var?}"
    }
    ensure_port WEB_PORT web 3000 3100
    ensure_port VK_BOT_PORT vk-bot 3002 3102 "$WEB_PORT"
  else
    echo "  ⚠ нет утилиты ss — проверка портов пропущена"
  fi
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
# Проверяем содержимое ответа, а не только код: на том же порту/домене может отвечать чужое приложение.
is_drago() { local body; body=$(curl -fsS --max-time 10 "$@" 2>/dev/null) || return 1; [[ "$body" == *'"app":"drago"'* ]]; }
if [ "${REVERSE_PROXY:-caddy}" = "ispmanager" ]; then
  if is_drago "http://127.0.0.1:${WEB_PORT:-3100}/api/health"; then
    echo "✅ «Драго» отвечает на 127.0.0.1:${WEB_PORT:-3100}"
  else
    echo "❌ на 127.0.0.1:${WEB_PORT:-3100} отвечает не «Драго» — смотрите: make ps; ss -ltnp | grep ${WEB_PORT:-3100}"; exit 1
  fi
  # Прокси nginx должен смотреть на тот же порт: иначе домен уйдёт на чужое приложение.
  PROXY_CONF=$(grep -ls "__drago_web__" /etc/nginx/vhosts-resources/*/drago-proxy.conf 2>/dev/null | head -1 || true)
  if [ -n "$PROXY_CONF" ]; then
    PROXY_PORT=$(sed -n '/__drago_web__/,/}/s/.*proxy_pass http:\/\/127\.0\.0\.1:\([0-9]*\).*/\1/p' "$PROXY_CONF" | head -1)
    if [ "$PROXY_PORT" != "${WEB_PORT:-3100}" ]; then
      echo "⚠ nginx проксирует на порт ${PROXY_PORT:-?}, а «Драго» слушает ${WEB_PORT:-3100} — обновляю прокси"
      if [ "$(id -u)" -eq 0 ]; then bash infrastructure/ispmanager/install-nginx-proxy.sh "$DOMAIN" || true
      else echo "   выполните: make nginx-proxy"; fi
    fi
  fi
  if is_drago "https://${DOMAIN}/api/health"; then
    echo "✅ https://${DOMAIN} отвечает через nginx ISPmanager"
  else
    echo "⚠ https://${DOMAIN} пока не отдаёт «Драго». Нужны: DNS на этот сервер, SSL-сертификат сайта в ISPmanager, затем make nginx-proxy"
  fi
else
  is_drago "https://${DOMAIN}/api/health" && echo "✅ https://${DOMAIN} отвечает" || echo "⚠ https://${DOMAIN} пока не отвечает (DNS/сертификат?)"
fi
docker image prune -f >/dev/null
# Держим кэш сборки в разумных пределах (на небольшом диске он быстро разрастается до десятков ГБ).
docker builder prune -f --max-used-space 4gb >/dev/null 2>&1 || docker builder prune -f --filter until=72h >/dev/null 2>&1 || true
echo "▶ Готово. Лог: $LOG"
