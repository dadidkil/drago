#!/usr/bin/env bash
# Создаёт .env из .env.example с криптографически стойкими секретами (openssl rand).
# Существующий .env не перезаписывается.
#   bash infrastructure/scripts/gen-secrets.sh
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
ENV="$ROOT/.env"
[ -f "$ENV" ] && { echo ".env уже существует — не перезаписываю ($ENV)"; exit 1; }
umask 077
pg=$(openssl rand -hex 24)
redis=$(openssl rand -hex 24)
key=$(openssl rand -base64 32)
vk=$(openssl rand -hex 20)
sed -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$pg|" \
    -e "s|__POSTGRES_PASSWORD__|$pg|" \
    -e "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$redis|" \
    -e "s|__REDIS_PASSWORD__|$redis|" \
    -e "s|^APP_ENCRYPTION_KEY=.*|APP_ENCRYPTION_KEY=$key|" \
    -e "s|^VK_CALLBACK_SECRET=.*|VK_CALLBACK_SECRET=$vk|" \
    "$ROOT/.env.example" > "$ENV"
chmod 600 "$ENV"
echo "✅ $ENV создан (права 600). Заполните вручную: SMTP_*, TELEGRAM_*, VK_GROUP_ID, VK_ACCESS_TOKEN, VK_CONFIRMATION_CODE, ACME_EMAIL."
echo "⚠  APP_ENCRYPTION_KEY нельзя менять после запуска (им зашифрованы 2FA-секреты). Сохраните .env в менеджере паролей."
