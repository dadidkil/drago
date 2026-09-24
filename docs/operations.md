# Эксплуатация

## Частые команды (`make help`)

```bash
make ps                          # статус
make logs s=web                  # логи сервиса (web, worker, telegram-bot, vk-bot, caddy, postgres)
make deploy                      # обновление
make backup                      # бэкап сейчас
make restore f=<dump> [u=<uploads.tar.gz>]
make invite-admin email=...      # приглашение суперадмина
make reset-link email=...        # ссылка сброса пароля (если SMTP не работает)
make shell-db                    # psql
```

## Бэкапы

- Контейнер `backup` ежедневно в `BACKUP_HOUR_UTC` (по умолчанию 00:00 UTC = 03:00 МСК) делает `pg_dump -Fc` с
  проверкой через `pg_restore --list` и архивирует загруженные файлы.
- Хранение: `/srv/drago/backups/{daily,weekly,monthly}` — 14 дней, 8 недель, 6 месяцев.
- Перед каждой миграцией `deploy.sh` делает внеочередной бэкап.
- **Обязательно копируйте бэкапы за пределы сервера.** Пример: cron на другом компьютере
  `rsync -a root@2.56.90.240:/srv/drago/backups/ ~/drago-backups/`, либо rclone в Яндекс Object Storage или VK Cloud.
  Шифруйте копии (например, `age`): в них персональные данные.
- Раз в квартал проверяйте восстановление на тестовой машине: `make restore`.

## Логи

- Приложения пишут структурированный JSON в stdout, Docker ротирует логи (20 МБ × 5).
- Caddy access log: том `caddy_data`, `/data/logs/access.log`, ротация 20 МБ × 7. Содержит IP — храните не дольше
  необходимого.
- Журнал действий администраторов: `/admin/audit`, срок хранения задаётся в настройках.

## Мониторинг

- `GET https://dragotop.ru/api/health` → `{"status":"ok"}` проверяет процесс и БД. Подключите внешний мониторинг,
  например UptimeRobot, с уведомлением в Telegram.
- Состояние интеграций: `/admin/integrations`. Очередь и ошибки уведомлений: `/admin/dashboard`.
- Docker healthcheck: web, worker (heartbeat-файл), vk-bot, postgres, redis. Упавшие контейнеры перезапускаются
  (`restart: unless-stopped`).

## Обновление зависимостей

```bash
pnpm outdated -r
pnpm up -r --latest   # в отдельной ветке → CI → деплой
```

Базовые образы (`postgres:17`, `redis:7`, `caddy:2`, `node:22`) обновляются при `make deploy` — `build --pull`.
Мажорные обновления PostgreSQL делаются через дамп и восстановление.

## Типовые задачи

| Задача | Где |
|---|---|
| Добавить бойца | `/admin/users/new` → приглашение на email |
| Принять кандидата из заявки | `/admin/applications/:id` → «Создать аккаунт и пригласить» |
| Выдать почту | `/admin/mail` |
| Боец потерял телефон с 2FA | `/admin/users/:id` → «Сбросить 2FA» (после проверки личности) |
| Боец выбыл | `/admin/users/:id` → статус «В архиве»; при необходимости удалить ящик |
| Сменить контакты или слоган на сайте | `/admin/pages/contacts` |
| Изменить права ролей | `/admin/settings` (SUPERADMIN) |
