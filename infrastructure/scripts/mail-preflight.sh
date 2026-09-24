#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Проверка готовности сервера и DNS к почте @домен. Ничего не меняет.
#   bash infrastructure/scripts/mail-preflight.sh dragotop.ru [mail.dragotop.ru]
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
DOMAIN=${1:-dragotop.ru}; MAILHOST=${2:-mail.$DOMAIN}
ok() { echo -e "  \033[32m✔\033[0m $*"; }; bad() { echo -e "  \033[31m✘\033[0m $*"; FAIL=1; }; FAIL=0
IP=$(curl -4 -s --max-time 5 https://ifconfig.me)
echo "Сервер: $IP"

echo "1. Исходящий SMTP (порт 25) — без него письма не уйдут на Gmail/Яндекс/Mail.ru"
timeout 8 bash -c 'exec 3<>/dev/tcp/gmail-smtp-in.l.google.com/25 && head -c 3 <&3 | grep -q 220' && ok "порт 25 открыт" || bad "порт 25 закрыт — попросите хостинг открыть или используйте внешний провайдер"

echo "2. PTR (обратная зона) для $IP"
PTR=$(dig +short -x "$IP" | sed 's/\.$//')
[ "$PTR" = "$MAILHOST" ] && ok "PTR = $PTR" || bad "PTR = '${PTR:-нет}', нужно $MAILHOST (настраивается у хостинг-провайдера)"

echo "3. A-запись $MAILHOST"
[ "$(dig +short A "$MAILHOST" | tail -1)" = "$IP" ] && ok "$MAILHOST → $IP" || bad "$MAILHOST не указывает на $IP"

echo "4. MX"
MX=$(dig +short MX "$DOMAIN"); echo "$MX" | grep -q "$MAILHOST" && ok "MX: $MX" || bad "MX: '${MX:-нет}' (нужно 10 $MAILHOST.)"

echo "5. SPF"
SPF=$(dig +short TXT "$DOMAIN" | tr -d '"' | grep '^v=spf1'); [ -n "$SPF" ] && ok "$SPF" || bad "SPF не найден"

echo "6. DKIM (селектор ${DKIM_SELECTOR:-drago})"
DKIM=$(dig +short TXT "${DKIM_SELECTOR:-drago}._domainkey.$DOMAIN" | tr -d '"'); [ -n "$DKIM" ] && ok "DKIM найден" || bad "DKIM не найден"

echo "7. DMARC"
DMARC=$(dig +short TXT "_dmarc.$DOMAIN" | tr -d '"'); [ -n "$DMARC" ] && ok "$DMARC" || bad "DMARC не найден"

echo "8. Блок-листы для $IP"
REV=$(echo "$IP" | awk -F. '{print $4"."$3"."$2"."$1}')
for bl in zen.spamhaus.org bl.spamcop.net b.barracudacentral.org; do
  [ -n "$(dig +short "$REV.$bl")" ] && bad "в списке $bl" || ok "нет в $bl"
done

echo
[ $FAIL = 0 ] && echo "✅ Базовые проверки пройдены. Отправьте тестовые письма на Gmail/Яндекс/Mail.ru и проверьте заголовки (SPF/DKIM/DMARC = pass)." \
             || echo "❌ Есть проблемы — почту НЕ считать рабочей (см. docs/mail.md)."
