#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# READ-ONLY диагностика «сайт открывается не у всех» (VPN, телефоны, другие сети).
# Ничего не меняет. Отчёт: /root/drago-access-<время>.txt
#   sudo bash infrastructure/scripts/diag-access.sh [домен]
# Смотрит то, что обычно ломает доступ части посетителей:
#   DNS (разные ответы, лишняя AAAA), IPv6, цепочку сертификата (Android), TLS-протоколы,
#   брандмауэр/блокировку по странам, fail2ban, лимиты запросов nginx и ошибки в логах.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
DOMAIN=${1:-$(grep -s '^DOMAIN=' "$ROOT/.env" | cut -d= -f2 | tr -d "\"'")}
DOMAIN=${DOMAIN:-dragotop.ru}
OUT=/root/drago-access-$(date +%Y%m%d-%H%M%S).txt
exec > >(tee "$OUT") 2>&1

section() { printf '\n══════ %s ══════\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }
ok() { echo "  ✔ $*"; }
bad() { echo "  ✘ $*"; }
note() { echo "  • $*"; }

SERVER_IP=$(curl -4 -s --max-time 5 https://ifconfig.me || true)
echo "Домен: $DOMAIN   IP сервера: ${SERVER_IP:-не определён}   $(date -Is)"

section "1. DNS: все ли резолверы отдают этот сервер"
if have dig; then
  for r in "" 8.8.8.8 1.1.1.1 77.88.8.8; do
    for h in "$DOMAIN" "www.$DOMAIN"; do
      a=$(dig ${r:+@$r} +short A "$h" | grep -E '^[0-9.]+$' | tr '\n' ' ')
      [ "$(echo "$a" | xargs)" = "$SERVER_IP" ] && ok "${r:-системный} A $h = $a" || bad "${r:-системный} A $h = ${a:-нет} (ожидается $SERVER_IP)"
    done
  done
  aaaa=$(dig +short AAAA "$DOMAIN"; dig +short AAAA "www.$DOMAIN")
  if [ -n "$aaaa" ]; then
    bad "есть AAAA-записи: $(echo $aaaa) — устройства с IPv6 (часто мобильные сети) пойдут по ним"
    ss -H -ltn | awk '{print $4}' | grep -qE '^\[.*\]:443$' && note "nginx слушает IPv6:443" || bad "nginx НЕ слушает IPv6:443 — удалите AAAA в REG.RU или включите IPv6 у сайта"
  else
    ok "AAAA-записей нет (IPv6-клиенты придут по IPv4)"
  fi
else
  note "dig не установлен: apt-get install -y dnsutils"
fi

section "2. Сертификат и TLS (так видят сайт разные устройства)"
LISTEN_IP=$(ss -H -ltn 2>/dev/null | awk '{print $4}' | grep -E ':443$' | grep -vE '^(\*|0\.0\.0\.0|\[)' | head -1 | cut -d: -f1)
LISTEN_IP=${LISTEN_IP:-127.0.0.1}
if have openssl; then
  chain=$(openssl s_client -connect "$LISTEN_IP:443" -servername "$DOMAIN" -showcerts </dev/null 2>/dev/null)
  n=$(grep -c "BEGIN CERTIFICATE" <<<"$chain")
  vr=$(grep -m1 "Verify return code" <<<"$chain" | sed 's/^ *//')
  if [ "${n:-0}" -eq 0 ]; then
    bad "не удалось получить сертификат с $LISTEN_IP:443 — nginx не слушает 443 или SSL у сайта выключен"
  else
  subj=$(openssl x509 -noout -subject -enddate 2>/dev/null <<<"$chain" | tr '\n' ' ')
  echo "  $subj"
  [ "${n:-0}" -ge 2 ] && ok "сервер отдаёт цепочку из $n сертификатов" || bad "сервер отдаёт $n сертификат(а) без промежуточного — старые Android и часть приложений не откроют сайт; в ISPmanager выберите сертификат заново или переиздайте Let's Encrypt"
  [[ "$vr" == *"0 (ok)"* ]] && ok "$vr" || bad "$vr"
  for p in tls1_2 tls1_3; do
    if openssl s_client -connect "$LISTEN_IP:443" -servername "$DOMAIN" -"$p" </dev/null >/dev/null 2>&1; then ok "$p поддерживается"; else note "$p не поддерживается"; fi
  done
  host_names=$(openssl x509 -noout -ext subjectAltName 2>/dev/null <<<"$chain" | tr ',' '\n' | grep -o 'DNS:[^ ]*' | tr '\n' ' ')
  [[ "$host_names" == *"DNS:www.$DOMAIN"* ]] && ok "сертификат покрывает www.$DOMAIN" || bad "сертификат НЕ покрывает www.$DOMAIN ($host_names) — адрес с www будет с ошибкой"
  fi
fi

section "3. Брандмауэр: блокировки по странам и IP"
if have iptables; then
  echo "  правил DROP/REJECT: $(iptables -S 2>/dev/null | grep -cE 'DROP|REJECT')  (IPv6: $(ip6tables -S 2>/dev/null | grep -cE 'DROP|REJECT'))"
  iptables -S 2>/dev/null | grep -E 'dport (80|443)|dports [^ ]*(80|443)|match-set' | head -20 | sed 's/^/  /'
  iptables -S INPUT 2>/dev/null | head -3 | sed 's/^/  политика: /'
fi
if have ipset; then
  sets=$(ipset list -n 2>/dev/null)
  [ -n "$sets" ] && { echo "  ipset-списки:"; for s in $sets; do echo "    $s: $(ipset list "$s" 2>/dev/null | grep -cE '^[0-9]') записей"; done; }
  echo "$sets" | grep -qiE 'countr|geo|allow|white' && bad "есть списки, похожие на блокировку по странам — проверьте ISPmanager → Брандмауэр → «Страны»"
fi
have nft && echo "  nftables: правил drop/reject: $(nft list ruleset 2>/dev/null | grep -cE 'drop|reject')"
note "если сайт не открывается из-за VPN — проверьте также защиту от DDoS/гео-фильтр у хостера (в его панели, не в ISPmanager)"

section "4. fail2ban"
if have fail2ban-client; then
  for j in $(fail2ban-client status 2>/dev/null | sed -n 's/.*Jail list:\s*//p' | tr ',' ' '); do
    echo "  $j: забанено сейчас $(fail2ban-client status "$j" 2>/dev/null | sed -n 's/.*Currently banned:\s*//p')"
  done
else
  note "fail2ban не установлен"
fi

section "5. nginx: лимиты запросов для $DOMAIN"
if have nginx; then
  conf=$(nginx -T 2>/dev/null)
  grep -nE "limit_req_zone|limit_conn_zone" <<<"$conf" | grep -i "$DOMAIN" | sed 's/^/  /'
  awk -v d="$DOMAIN" '/server_name/ && index($0,d){f=1} f&&/limit_req |limit_conn /{print "  " $0} /^}/{f=0}' <<<"$conf" | sort -u
  grep -E "ssl_protocols|ssl_ciphers" <<<"$conf" | sort -u | head -4 | sed 's/^/  /'
fi

section "6. Логи nginx (последние 5000 запросов к $DOMAIN)"
LOG=/var/www/httpd-logs/$DOMAIN.access.log; [ -f "$LOG" ] || LOG=""
ELOG=/var/www/httpd-logs/$DOMAIN.error.log; [ -f "$ELOG" ] || ELOG=""
if [ -n "$LOG" ]; then
  tail -5000 "$LOG" | awk '{print $9}' | grep -E '^[0-9]{3}$' | sort | uniq -c | sort -rn | head -8 | sed 's/^/  код /'
  echo "  ответы 403/429/444/503 (отказ или лимит) — последние 5:"
  tail -5000 "$LOG" | awk '$9 ~ /^(403|429|444|503)$/' | tail -5 | cut -c1-200 | sed 's/^/    /'
else
  note "лог доступа не найден в /var/www/httpd-logs/"
fi
[ -n "$ELOG" ] && { echo "  ошибки nginx (последние 5):"; tail -200 "$ELOG" | grep -vE 'acme-challenge' | tail -5 | cut -c1-220 | sed 's/^/    /'; }
note "Живая проверка: tail -f /var/www/httpd-logs/$DOMAIN.access.log — и откройте сайт с проблемного устройства."
note "Запроса нет в логе → соединение режется ДО nginx (DNS, брандмауэр, хостер, провайдер)."
note "Запрос есть с кодом 403/429/503 → отказывает nginx (лимиты, защита от DDoS ISPmanager)."

echo
echo "Отчёт сохранён: $OUT"
