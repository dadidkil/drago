#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Шаг 0. READ-ONLY аудит сервера перед любыми изменениями.
# Ничего не меняет. Отчёт: /root/drago-audit-<время>.txt
#   sudo bash infrastructure/scripts/00-server-audit.sh
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
TS=$(date +%Y%m%d-%H%M%S)
OUT=${1:-/root/drago-audit-$TS.txt}
exec > >(tee "$OUT") 2>&1

section() { printf '\n══════ %s ══════\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

section "Система"
date -Is; hostnamectl 2>/dev/null || hostname
cat /etc/os-release 2>/dev/null | grep -E '^(PRETTY_NAME|VERSION_ID)='
uname -a; uptime

section "Ресурсы"
nproc; free -h; df -hT -x tmpfs -x devtmpfs; lsblk 2>/dev/null
swapon --show 2>/dev/null || true

section "Сеть"
ip -brief address 2>/dev/null || ifconfig
echo "Публичный IP (по данным сервера):"; curl -4 -s --max-time 5 https://ifconfig.me || true; echo
echo "PTR для публичных IP:"; for ip in $(hostname -I 2>/dev/null); do printf '%s → ' "$ip"; (have dig && dig +short -x "$ip") || (have host && host "$ip") || echo "нет dig/host"; done

section "Открытые порты (слушающие)"
ss -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null

section "Firewall"
(have ufw && ufw status verbose) || echo "ufw не установлен"
(have nft && nft list ruleset 2>/dev/null | head -80) || true
(have iptables && iptables -S 2>/dev/null | head -60) || true

section "SSH"
sshd -T 2>/dev/null | grep -Ei '^(port|permitrootlogin|passwordauthentication|pubkeyauthentication|kbdinteractiveauthentication|allowusers|maxauthtries) '
for f in /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys; do [ -f "$f" ] && echo "$f: $(grep -cE '^(ssh|ecdsa|sk-)' "$f") ключ(ей)"; done
(have fail2ban-client && fail2ban-client status) || echo "fail2ban не установлен"

section "Docker"
if have docker; then docker version --format '{{.Server.Version}}' 2>/dev/null; docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'; docker volume ls; docker network ls; else echo "Docker не установлен"; fi

section "Панель управления"
if [ -x /usr/local/mgr5/sbin/mgrctl ]; then
  echo "ISPmanager: УСТАНОВЛЕН (/usr/local/mgr5)"
  /usr/local/mgr5/sbin/mgrctl -m ispmgr license.info 2>/dev/null | grep -Ei 'name|version|expire' | head -5 || true
  echo "— Сайты (webdomain):"; /usr/local/mgr5/sbin/mgrctl -m ispmgr webdomain 2>/dev/null | head -20 || true
  echo "— Почтовые домены (emaildomain):"; /usr/local/mgr5/sbin/mgrctl -m ispmgr emaildomain 2>/dev/null | head -20 || true
  echo "— Доменные имена DNS (domain):"; /usr/local/mgr5/sbin/mgrctl -m ispmgr domain 2>/dev/null | head -20 || true
  echo "— Каталоги nginx vhosts:"; ls -la /etc/nginx/vhosts /etc/nginx/vhosts-resources 2>/dev/null | head -30
else
  echo "ISPmanager не найден"
fi
for p in /usr/local/fastpanel2 /usr/local/vesta /usr/local/hestia /usr/local/cpanel /opt/brainycp; do [ -e "$p" ] && echo "Обнаружена другая панель: $p"; done

section "DNS домена"
if have dig; then for d in ${DRAGO_DOMAIN:-dragotop.ru}; do echo "NS: $(dig +short NS "$d" | tr '\n' ' ')"; echo "A:  $(dig +short A "$d" | tr '\n' ' ')"; echo "MX: $(dig +short MX "$d" | tr '\n' ' ')"; done; fi

section "Веб-серверы"
for s in nginx apache2 httpd caddy lighttpd; do systemctl is-active "$s" >/dev/null 2>&1 && echo "$s: АКТИВЕН"; done
ls -la /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null
ls -la /etc/apache2/sites-enabled 2>/dev/null
ls -la /var/www 2>/dev/null
ls -la /etc/letsencrypt/live 2>/dev/null

section "Базы данных"
for s in postgresql mysql mariadb redis-server redis mongod; do systemctl is-active "$s" >/dev/null 2>&1 && echo "$s: АКТИВЕН"; done
(have psql && sudo -u postgres psql -lqt 2>/dev/null | cut -d'|' -f1 | sed '/^\s*$/d') || true
(have mysql && mysql -e 'SHOW DATABASES' 2>/dev/null) || true

section "Почта"
for s in postfix exim4 dovecot sendmail; do systemctl is-active "$s" >/dev/null 2>&1 && echo "$s: АКТИВЕН"; done
echo "Исходящий порт 25 (проверка до gmail-smtp-in.l.google.com):"
timeout 8 bash -c 'exec 3<>/dev/tcp/gmail-smtp-in.l.google.com/25 && head -c 60 <&3' 2>/dev/null && echo " → ОТКРЫТ" || echo " → ЗАКРЫТ/недоступен (часто блокируется хостингом)"

section "Сервисы и задания"
systemctl list-units --type=service --state=running --no-pager 2>/dev/null | head -60
crontab -l 2>/dev/null; ls /etc/cron.d 2>/dev/null

section "Процессы (топ по памяти)"
ps aux --sort=-%mem | head -20

section "Пользователи с shell"
awk -F: '$7 ~ /(bash|sh|zsh)$/ {print $1" uid="$3" home="$6}' /etc/passwd

echo; echo "Отчёт сохранён: $OUT"
