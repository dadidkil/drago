#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Бэкап PostgreSQL (pg_dump -Fc) и загруженных файлов с ротацией.
#   backup.sh once   — один бэкап сейчас
#   backup.sh loop   — ежедневно в BACKUP_HOUR_UTC (для контейнера)
# Хранение: 14 ежедневных, 8 еженедельных (вс), 6 ежемесячных (1-е число).
# ВАЖНО: копируйте /srv/drago/backups на внешний носитель/облако (см. docs/operations.md).
# ─────────────────────────────────────────────────────────────────────────────
set -eu
umask 077
ROOT=/backups

run_backup() {
  ts=$(date -u +%Y%m%d-%H%M)
  dow=$(date -u +%u)
  dom=$(date -u +%d)
  mkdir -p "$ROOT/daily" "$ROOT/weekly" "$ROOT/monthly"

  db_file="$ROOT/daily/db-$ts.dump"
  pg_dump --format=custom --compress=9 --no-owner --file="$db_file.tmp"
  mv "$db_file.tmp" "$db_file"
  # Проверка целостности дампа
  pg_restore --list "$db_file" >/dev/null

  files_file="$ROOT/daily/uploads-$ts.tar.gz"
  if [ -d /uploads ]; then
    tar -czf "$files_file.tmp" -C /uploads . && mv "$files_file.tmp" "$files_file"
  fi

  [ "$dow" = "7" ] && cp "$db_file" "$ROOT/weekly/" && { [ -f "$files_file" ] && cp "$files_file" "$ROOT/weekly/" || true; }
  [ "$dom" = "01" ] && cp "$db_file" "$ROOT/monthly/" && { [ -f "$files_file" ] && cp "$files_file" "$ROOT/monthly/" || true; }

  prune "$ROOT/daily" 28     # 14 дней × 2 файла
  prune "$ROOT/weekly" 16
  prune "$ROOT/monthly" 12
  echo "$(date -u +%FT%TZ) backup ok: $db_file ($(du -h "$db_file" | cut -f1))"
}

prune() {
  dir=$1; keep=$2
  # shellcheck disable=SC2012
  ls -1t "$dir" 2>/dev/null | tail -n +$((keep + 1)) | while read -r f; do rm -f "$dir/$f"; done
}

case "${1:-once}" in
  once) run_backup ;;
  loop)
    echo "backup loop started, daily at ${BACKUP_HOUR_UTC:-0}:00 UTC"
    last=""
    while true; do
      hour=$(date -u +%H | sed 's/^0//')
      today=$(date -u +%F)
      if [ "${hour:-0}" -eq "${BACKUP_HOUR_UTC:-0}" ] && [ "$last" != "$today" ]; then
        run_backup || echo "$(date -u +%FT%TZ) BACKUP FAILED" >&2
        last=$today
      fi
      sleep 300
    done
    ;;
  *) echo "usage: backup.sh once|loop" >&2; exit 1 ;;
esac
