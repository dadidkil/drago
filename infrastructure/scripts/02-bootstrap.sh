#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Шаг 2. Подготовка сервера (Ubuntu/Debian): Docker, UFW, fail2ban, автообновления,
# swap, каталоги данных. Идемпотентно. SSH-доступ НЕ ломает: порт SSH разрешается до включения UFW.
#   sudo bash infrastructure/scripts/02-bootstrap.sh [--with-mail]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
WITH_MAIL=0; [ "${1:-}" = "--with-mail" ] && WITH_MAIL=1
ISPMANAGER=0; [ -x /usr/local/mgr5/sbin/mgrctl ] && ISPMANAGER=1
DATA_DIR=${DATA_DIR:-/srv/drago}
log() { echo -e "\033[1;32m▶\033[0m $*"; }

[ "$(id -u)" -eq 0 ] || { echo "Запустите от root"; exit 1; }
. /etc/os-release
case "$ID" in ubuntu|debian) ;; *) echo "Поддерживаются Ubuntu/Debian, у вас $ID"; exit 1 ;; esac

log "Пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
if [ $ISPMANAGER = 1 ]; then
  # На сервере с ISPmanager файрволом управляет панель — UFW не ставим, чтобы не было конфликтов правил.
  apt-get install -y ca-certificates curl gnupg fail2ban unattended-upgrades git dnsutils jq make
else
  apt-get install -y ca-certificates curl gnupg ufw fail2ban unattended-upgrades git dnsutils jq make
fi

if ! command -v docker >/dev/null; then
  log "Docker Engine + compose plugin (официальный репозиторий)"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$ID $VERSION_CODENAME stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
mkdir -p /etc/docker
if [ ! -f /etc/docker/daemon.json ]; then
  cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "5" },
  "live-restore": true,
  "no-new-privileges": true
}
JSON
  systemctl restart docker
fi
systemctl enable --now docker

SSH_PORT=$(sshd -T 2>/dev/null | awk '/^port /{print $2; exit}'); SSH_PORT=${SSH_PORT:-22}
if [ $ISPMANAGER = 1 ]; then
  log "Обнаружен ISPmanager: UFW пропущен. Правила файрвола задайте в панели (Сеть → Брандмауэр), см. docs/deployment.md"
else
log "Firewall (UFW): SSH, HTTP, HTTPS$( [ $WITH_MAIL = 1 ] && echo ', почтовые порты')"
ufw allow "$SSH_PORT/tcp" comment 'SSH'
ufw allow 80/tcp comment 'HTTP (ACME + redirect)'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 443/udp comment 'HTTP/3'
if [ $WITH_MAIL = 1 ]; then
  for p in 25 465 587 993; do ufw allow "$p/tcp" comment 'mail'; done
fi
ufw default deny incoming
ufw default allow outgoing
ufw --force enable
# Docker публикует порты в обход UFW — поэтому в compose наружу опубликованы ТОЛЬКО 80/443 (Caddy).
fi

log "fail2ban (sshd + recidive)"
install -m 0644 "$(dirname "$0")/../fail2ban/jail.local" /etc/fail2ban/jail.d/drago.local
sed -i "s/^port *= *ssh$/port = $SSH_PORT/" /etc/fail2ban/jail.d/drago.local
systemctl enable --now fail2ban
systemctl restart fail2ban

log "Автоматические обновления безопасности"
dpkg-reconfigure -f noninteractive unattended-upgrades || true

MEM_MB=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)
if [ "$MEM_MB" -lt 3000 ] && ! swapon --show | grep -q .; then
  log "Swap 2G (RAM ${MEM_MB} МБ)"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 && echo 'vm.swappiness=10' > /etc/sysctl.d/99-drago.conf
fi

log "Каталоги данных: $DATA_DIR"
mkdir -p "$DATA_DIR/uploads" "$DATA_DIR/backups"
chown 1000:1000 "$DATA_DIR/uploads"   # uid пользователя node в контейнерах
chmod 750 "$DATA_DIR/uploads"
chmod 700 "$DATA_DIR/backups"

log "Готово. Дальше: сгенерируйте .env (scripts/gen-secrets.sh) и выполните scripts/deploy.sh"
log "Отключение входа по паролю SSH — отдельным шагом: scripts/03-harden-ssh.sh (после проверки входа по ключу!)"
