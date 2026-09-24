# Архитектура

## Обзор

```
                         Интернет
                            │  80/443 (TCP+UDP/HTTP3)
                     ┌──────▼───────┐
                     │    Caddy     │  TLS (Let's Encrypt), HTTP→HTTPS, gzip/zstd, логи
                     └──┬────────┬──┘
          /vk/callback  │        │  всё остальное
                ┌───────▼──┐  ┌──▼─────────────────────────────┐
                │  vk-bot  │  │ web (Next.js 16, standalone)    │
                │ Callback │  │  • публичный сайт               │
                │   API    │  │  • /cabinet — кабинет бойца     │
                └────┬─────┘  │  • /admin   — админ-панель      │
                     │        │  • Server Actions = backend     │
   ┌──────────────┐  │        └──────┬──────────────────────────┘
   │ telegram-bot │  │               │
   │ (long poll)  │  │  ┌────────────┴───┐
   └──────┬───────┘  │  │     worker     │ outbox уведомлений → Telegram / VK / Email
          │          │  │                │ напоминания, очистка по срокам хранения
          │          │  └──────┬─────────┘
   ───────┴──────────┴─────────┴──────────────  сеть db (internal: true, без интернета)
                  ┌────────────┐   ┌─────────┐   ┌──────────┐
                  │ PostgreSQL │   │  Redis  │   │  backup  │ pg_dump + uploads, ротация
                  └────────────┘   └─────────┘   └──────────┘
```

Наружу опубликованы только порты Caddy. PostgreSQL и Redis находятся в Docker-сети `db` с `internal: true`: у них нет
ни опубликованных портов, ни выхода в интернет.

## Почему Next.js full-stack, а не отдельный NestJS

- Один язык, одни типы и одна кодовая база для сайта, кабинета и админки. Server Actions и Route Handlers покрывают
  весь backend этого масштаба: сотни пользователей, десятки RPS в пике.
- Меньше движущихся частей: нет отдельного API-сервиса, CORS и второй схемы авторизации. CSRF-защита Server Actions
  (проверка Origin) встроена, а `proxy.ts` дополнительно требует заголовок Origin.
- Бизнес-логика, общая для сайта, ботов и воркера, вынесена в `packages/core`. Если понадобится отдельный публичный
  API (например, мобильное приложение), его можно поднять на тех же `@drago/core` и `@drago/database`, не трогая домен.

## Структура монорепозитория

```
apps/
  web/            Next.js: сайт, кабинет, админка, /api/files, /media, /api/health
  telegram-bot/   grammY, long polling; команды бойцов и командного состава
  vk-bot/         HTTP-сервер VK Callback API (secret, confirmation, дедупликация)
  worker/         доставка уведомлений (outbox), напоминания, очистка
packages/
  database/       Prisma 7: схема, миграции, клиент, сид, CLI (приглашение суперадмина)
  shared/         изоморфный код: RBAC, валидация (zod), настройки, форматирование, slug
  core/           серверная доменная логика: уведомления, аудит, заявки, почта,
                  rate limit, криптография, коды привязки, API Telegram/VK, диалог анкеты
infrastructure/
  docker/Dockerfile          multi-stage: web, worker, telegram-bot, vk-bot, migrate
  docker-compose.yml         production-стек
  caddy/Caddyfile            reverse proxy + TLS
  mail/                      опциональный self-hosted почтовый стек (Stalwart + Roundcube)
  backup/backup.sh           бэкапы с ротацией
  scripts/                   аудит сервера, бэкап существующего, bootstrap, SSH-hardening, деплой, restore
docs/                        документация
```

Отдельного пакета `ui` нет: UI используется только в `apps/web` (`src/components`), и отдельный пакет добавил бы
лишний слой сборки без пользы. Когда появится второй фронтенд, компоненты можно вынести без изменения API.

## Данные

Схема: `packages/database/prisma/schema.prisma`. Основные сущности:

- **Доступ:** `User`, `Profile`, `Role`, `Permission`, `RolePermission`, `Session`, `AuthToken`, `LinkCode`.
- **Мессенджеры:** `TelegramAccount`, `VkAccount`, `BotConversation`, `ProcessedUpdate`.
- **Контент:** `News`, `Page`, `TeamMember`, `Project`, `Achievement`, `FaqItem`, `Gallery`, `Photo`, `FileAsset`.
- **Жизнь отряда:** `Announcement`, `Event`, `EventParticipant`, `Task`, `TaskAssignee`, `TaskComment`,
  `Document`, `DocumentCategory`.
- **Набор:** `JoinApplication`.
- **Уведомления:** `Notification` (IN_APP), `NotificationDelivery` (outbox для TELEGRAM/VK/EMAIL),
  `NotificationPreference`.
- **Прочее:** `EmailAccount`, `AuditLog`, `Setting`.

## Поток уведомлений (пример: командир создал мероприятие)

1. Server Action `saveEvent` проверяет право `events.manage`, валидирует данные (zod) и сохраняет `Event` и
   `EventParticipant`.
2. `notify()` из `@drago/core` для каждого получателя создаёт `Notification` — она сразу видна в кабинете. Для каждого
   внешнего канала по настройкам пользователя и наличию привязок ставится `NotificationDelivery` со статусом `PENDING`.
3. Воркер каждые 5 с забирает пачку через `FOR UPDATE SKIP LOCKED` (можно запускать несколько воркеров) и отправляет её
   в Telegram Bot API, VK `messages.send` (детерминированный `random_id`) или SMTP.
4. Ошибки обрабатываются с backoff: 1 мин → 5 → 30 → 2 ч → 6 ч → 12 ч, затем `FAILED`. Если бот заблокирован
   (Telegram 403) или сообщения запрещены (VK 901), ставится `SKIPPED` и привязка помечается.
5. `audit()` фиксирует `event.create`.

## Авторизация

- Сессии хранятся в БД. В cookie `__Host-drago_session` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`) лежит
  случайный 256-битный токен, в БД — только его SHA-256.
- Время жизни: 14 дней неактивности и не более 30 дней абсолютно. Сессии можно просматривать и завершать в
  `/cabinet/security`.
- Пароли — Argon2id (m=19 МиБ, t=2, p=1). Защита от перечисления аккаунтов: одинаковые ответы и выравнивание
  времени через dummy-hash.
- TOTP 2FA (RFC 6238) с защитой от повторного использования кода и 8 одноразовыми резервными кодами (хранятся
  хэшами). Для командного состава 2FA обязательна (настройка).
- RBAC: права проверяются на сервере в каждом Server Action и Route Handler (`authorize()`, `requireAdmin()`) и в
  каждой команде бота. Дополнительно действует иерархия ролей: управлять можно только ролями ниже своей.

Подробнее: [security.md](security.md), [rbac.md](rbac.md).
