#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Подключает сайт ТОП «Драго» к nginx ISPmanager.
#   sudo bash infrastructure/ispmanager/install-nginx-proxy.sh dragotop.ru
# Находит vhost домена, каталог vhosts-resources, кладёт туда drago-proxy.conf,
# проверяет конфигурацию (nginx -t) и перезагружает nginx. При ошибке — откат.
# Конфиг сайта ISPmanager НЕ редактируется, поэтому изменения в панели его не затрут.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
DOMAIN=${1:?Укажите домен, например: dragotop.ru}
SRC="$(cd "$(dirname "$0")" && pwd)/nginx-drago-proxy.conf"
[ "$(id -u)" -eq 0 ] || { echo "Запустите от root"; exit 1; }
command -v nginx >/dev/null || { echo "nginx не найден"; exit 1; }

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

mkdir -p "$DIR"
TARGET="$DIR/drago-proxy.conf"
[ -f "$TARGET" ] && cp -a "$TARGET" "$TARGET.bak-$(date +%Y%m%d-%H%M%S)"
install -m 0644 "$SRC" "$TARGET"

if nginx -t 2>&1; then
  systemctl reload nginx 2>/dev/null || nginx -s reload
  echo "✅ nginx перезагружен. Проверка: curl -sI https://$DOMAIN/api/health"
else
  echo "❌ nginx -t не прошёл — откатываю"
  rm -f "$TARGET"
  latest=$(ls -1t "$DIR"/drago-proxy.conf.bak-* 2>/dev/null | head -1 || true)
  [ -n "$latest" ] && cp -a "$latest" "$TARGET"
  nginx -t && (systemctl reload nginx 2>/dev/null || nginx -s reload)
  exit 1
fi
