# ТОП «Драго» — цифровая инфраструктура

Сайт, личный кабинет бойца, админ-панель командного состава, Telegram-бот, VK-бот и корпоративная почта
трудового отряда подростков **ТОП «Драго»** (Трудовые отряды подростков Москвы, РСО). Всё работает на общей базе
данных и единой авторизации.

> _Огонь, вода, земля и воздух: вместе эти стихии создают — ТОП «Драго»._

## Что внутри

| Компонент | Технологии | Где |
|---|---|---|
| Публичный сайт: главная, о нас, команда, проекты, новости, галерея, события, вступление, контакты, SEO | Next.js 16, React 19, Tailwind CSS 4 | `apps/web/src/app/(site)` |
| Личный кабинет `/cabinet`: объявления, задачи, мероприятия, календарь, документы, отряд, почта, безопасность | Next.js Server Components и Server Actions | `apps/web/src/app/cabinet` |
| Админ-панель `/admin`: пользователи, заявки, контент, мероприятия, задачи, документы, галерея, почта, интеграции, аудит, настройки и матрица прав | то же | `apps/web/src/app/admin` |
| Авторизация: email и пароль (Argon2id), приглашения, восстановление, подтверждение email, сессии, TOTP 2FA, RBAC | собственная реализация | `apps/web/src/lib/auth`, `packages/shared/src/rbac.ts` |
| Telegram-бот | grammY, long polling | `apps/telegram-bot` |
| VK-бот | VK Callback API | `apps/vk-bot` |
| Воркер уведомлений: Telegram, VK, Email + in-app; напоминания; очистка | Node.js, outbox в PostgreSQL | `apps/worker` |
| База данных | PostgreSQL + Prisma 7 | `packages/database` |
| Инфраструктура: Docker, Caddy + Let's Encrypt, бэкапы, скрипты сервера | Docker Compose | `infrastructure` |

## Документация

- [Архитектура](docs/architecture.md)
- [Развёртывание на сервере](docs/deployment.md) — пошагово
- [DNS-записи для REG.RU](docs/dns-records.md)
- [Почта @dragotop.ru: сравнение вариантов и настройка](docs/mail.md)
- [Боты Telegram и VK](docs/bots.md)
- [Безопасность и 152-ФЗ](docs/security.md)
- [Роли и права](docs/rbac.md)
- [Эксплуатация: бэкапы, логи, мониторинг](docs/operations.md)
- [Исследование публичной информации о ТОП «Драго»](docs/research-drago.md)
- [Журнал выполненных действий](docs/operations-log.md)

## Локальная разработка

Требуется Node.js 22+, pnpm 10, PostgreSQL 16+ и, желательно, Redis.

```bash
pnpm install
cp .env.example .env         # укажите локальные DATABASE_URL, REDIS_URL, APP_URL=http://localhost:3000,
                             # APP_ENCRYPTION_KEY=$(openssl rand -base64 32), NODE_ENV=development
ln -s ../../.env apps/web/.env   # Next.js читает .env из каталога приложения
pnpm db:generate
pnpm db:migrate              # применить миграции
pnpm db:seed                 # роли, права, настройки, базовый контент
pnpm admin:invite --email you@example.com   # ссылка для установки пароля суперадмина
pnpm dev                     # http://localhost:3000
pnpm dev:worker              # воркер уведомлений (письма без SMTP пишутся в лог)
pnpm dev:tg / pnpm dev:vk    # боты (нужны токены в .env)
```

Проверки:

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Production

Кратко (подробно — в [deployment.md](docs/deployment.md)):

```bash
sudo bash infrastructure/scripts/00-server-audit.sh     # read-only аудит
sudo bash infrastructure/scripts/01-backup-existing.sh  # бэкап того, что уже есть
sudo bash infrastructure/scripts/02-bootstrap.sh        # Docker, UFW, fail2ban
bash infrastructure/scripts/gen-secrets.sh              # .env со стойкими секретами
make deploy                                             # сборка → миграции → запуск
make invite-admin email=you@example.com
```

Секреты хранятся только в `.env` на сервере (права 600); `.env` не коммитится.
