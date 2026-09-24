#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Шаг 1. Резервная копия всего, что уже есть на сервере, ДО изменений.
# Ничего не удаляет и не останавливает. Архив: /root/pre-drago-backup-<время>/
#   sudo bash infrastructure/scripts/01-backup-existing.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
umask 077
TS=$(date +%Y%m%d-%H%M%S)
DIR=/root/pre-drago-backup-$TS
mkdir -p "$DIR"
log() { echo "[$(date +%T)] $*" | tee -a "$DIR/backup.log"; }

log "Конфигурация /etc (nginx, apache, ssh, letsencrypt, systemd, cron, ufw, fail2ban)"
tar -czf "$DIR/etc.tar.gz" --ignore-failed-read -C / \
  $(for p in etc/nginx etc/apache2 etc/httpd etc/ssh etc/letsencrypt etc/systemd/system etc/cron.d etc/crontab etc/ufw etc/fail2ban etc/docker etc/hosts etc/fstab; do [ -e "/$p" ] && echo "$p"; done) 2>>"$DIR/backup.log" || true

if [ -d /var/www ]; then log "Сайты /var/www"; tar -czf "$DIR/var-www.tar.gz" -C /var www 2>>"$DIR/backup.log" || true; fi

crontab -l > "$DIR/root-crontab.txt" 2>/dev/null || true

if command -v pg_dumpall >/dev/null && systemctl is-active postgresql >/dev/null 2>&1; then
  log "PostgreSQL (системный) → pg_dumpall"
  sudo -u postgres pg_dumpall | gzip > "$DIR/postgres-all.sql.gz" || log "pg_dumpall: ошибка"
fi
if command -v mysqldump >/dev/null && (systemctl is-active mysql >/dev/null 2>&1 || systemctl is-active mariadb >/dev/null 2>&1); then
  log "MySQL/MariaDB → mysqldump --all-databases"
  mysqldump --all-databases --single-transaction --routines --events 2>>"$DIR/backup.log" | gzip > "$DIR/mysql-all.sql.gz" || log "mysqldump: ошибка"
fi

if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
  log "Docker: список контейнеров/томов и копия томов"
  docker ps -a > "$DIR/docker-ps.txt"
  docker volume ls -q > "$DIR/docker-volumes.txt"
  mkdir -p "$DIR/docker-volumes"
  while read -r vol; do
    [ -z "$vol" ] && continue
    docker run --rm -v "$vol":/v:ro -v "$DIR/docker-volumes":/out mirror.gcr.io/library/alpine:3 \
      tar -czf "/out/$vol.tar.gz" -C /v . 2>>"$DIR/backup.log" || log "том $vol: ошибка"
  done < "$DIR/docker-volumes.txt"
fi

( cd "$DIR" && sha256sum ./*.gz ./docker-volumes/*.gz 2>/dev/null > SHA256SUMS || true )
log "Готово: $DIR ($(du -sh "$DIR" | cut -f1)). Скопируйте его с сервера: scp -r root@<ip>:$DIR ."
