#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Подключает сайт ТОП «Драго» к nginx ISPmanager.
#   sudo bash infrastructure/ispmanager/install-nginx-proxy.sh dragotop.ru
# Находит vhost домена, каталог vhosts-resources, кладёт туда drago-proxy.conf
# (порты берутся из WEB_PORT/VK_BOT_PORT в .env), проверяет конфигурацию (nginx -t)
# и перезагружает nginx. При ошибке — откат.
# Конфиг сайта ISPmanager НЕ редактируется, поэтому изменения в панели его не затрут.
# Конфиги других сайтов сервера не читаются на запись и не меняются.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
DOMAIN=${1:?Укажите домен, например: dragotop.ru}
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
SRC="$HERE/nginx-drago-proxy.conf"
[ "$(id -u)" -eq 0 ] || { echo "Запустите от root"; exit 1; }
command -v nginx >/dev/null || { echo "nginx не найден"; exit 1; }

# Порты: переменные окружения > .env > значения по умолчанию
env_get() { grep -sE "^$1=" "$ROOT/.env" | tail -1 | cut -d= -f2- | tr -d "\"'\r" || true; }
WEB_PORT=${WEB_PORT:-$(env_get WEB_PORT)}; WEB_PORT=${WEB_PORT:-3100}
VK_BOT_PORT=${VK_BOT_PORT:-$(env_get VK_BOT_PORT)}; VK_BOT_PORT=${VK_BOT_PORT:-3102}
for p in "$WEB_PORT" "$VK_BOT_PORT"; do
  [[ "$p" =~ ^[0-9]+$ ]] && [ "$p" -ge 1024 ] && [ "$p" -le 65535 ] || { echo "❌ Некорректный порт в .env: $p"; exit 1; }
done
echo "порты: web → 127.0.0.1:$WEB_PORT, vk-bot → 127.0.0.1:$VK_BOT_PORT"

# Защита от ошибки: не направлять домен на чужое приложение (на сервере могут работать другие сайты).
HEALTH=$(curl -sS --max-time 5 "http://127.0.0.1:$WEB_PORT/api/health" 2>/dev/null || true)
if ! grep -q '"app":"drago"' <<<"$HEALTH"; then
  echo "❌ На 127.0.0.1:$WEB_PORT не отвечает приложение «Драго»."
  echo "   Кто слушает порт: $(ss -Hltnp "sport = :$WEB_PORT" 2>/dev/null | awk '{print $4, $6}' | head -1)"
  echo "   Сначала make deploy (он сам выберет свободный порт и запишет его в .env), затем повторите."
  [ "${FORCE:-0}" = "1" ] || exit 1
  echo "   FORCE=1 — продолжаю без проверки."
fi

VHOST=$(grep -rlE "server_name[^;]*[[:space:]]${DOMAIN//./\\.}([[:space:];]|$)" /etc/nginx/vhosts /etc/nginx/conf.d /etc/nginx/sites-enabled 2>/dev/null | head -1 || true)
[ -n "$VHOST" ] || { echo "❌ Не найден vhost для $DOMAIN. Создайте сайт в ISPmanager (Сайты → Создать)."; exit 1; }
echo "vhost: $VHOST"

INC=$(grep -oE "include[[:space:]]+/etc/nginx/vhosts-resources/[^;]+" "$VHOST" | head -1 | awk '{print $2}' || true)
[ -n "$INC" ] || { echo "❌ В $VHOST нет include vhosts-resources — версия ISPmanager не поддерживается этим скриптом, см. docs/deployment.md (ручной вариант)."; exit 1; }
DIR=$(dirname "$INC")
echo "каталог ресурсов сайта: $DIR"

SERVERS=$(grep -c "include[[:space:]]\+$DIR" "$VHOST" || true)
if ! grep -qE "listen[^;]*443" "$VHOST"; then
  echo "⚠ У сайта не включён SSL. Включите в ISPmanager: Сайты → $DOMAIN → SSL (Let's Encrypt) и «Перенаправлять HTTP на HTTPS»."
  echo "  Прокси работает только по HTTPS."
fi
echo "include подключён в server-блоков: $SERVERS"

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
sed -e "s/__DRAGO_WEB_PORT__/$WEB_PORT/g" -e "s/__DRAGO_VK_PORT__/$VK_BOT_PORT/g" "$SRC" > "$TMP"
! grep -q "__DRAGO_" "$TMP" || { echo "❌ В шаблоне остались незаменённые плейсхолдеры"; exit 1; }

mkdir -p "$DIR"
TARGET="$DIR/drago-proxy.conf"
[ -f "$TARGET" ] && cp -a "$TARGET" "$TARGET.bak-$(date +%Y%m%d-%H%M%S)"
install -m 0644 "$TMP" "$TARGET"

if nginx -t 2>&1; then
  systemctl reload nginx 2>/dev/null || nginx -s reload
  echo "✅ nginx перезагружен."
else
  echo "❌ nginx -t не прошёл — откатываю"
  rm -f "$TARGET"
  latest=$(ls -1t "$DIR"/drago-proxy.conf.bak-* 2>/dev/null | head -1 || true)
  [ -n "$latest" ] && cp -a "$latest" "$TARGET"
  nginx -t && (systemctl reload nginx 2>/dev/null || nginx -s reload)
  exit 1
fi

# Проверка через локальный nginx (не зависит от DNS)
sleep 1
via_nginx() { local body; body=$(curl -sS --max-time 10 --resolve "$DOMAIN:443:127.0.0.1" "$@" "https://$DOMAIN/api/health" 2>/dev/null) || return 1; [[ "$body" == *'"app":"drago"'* ]]; }
if via_nginx; then
  echo "✅ https://$DOMAIN → «Драго» (проверено через локальный nginx)"
elif via_nginx -k; then
  echo "⚠ Маршрут работает, но сертификат для $DOMAIN недействителен — выпустите Let's Encrypt в ISPmanager (Сайты → $DOMAIN → SSL)."
else
  echo "⚠ https://$DOMAIN через локальный nginx не отдаёт «Драго». Проверьте SSL сайта в ISPmanager и: nginx -T | grep -n drago"
fi
