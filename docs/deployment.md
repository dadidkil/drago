# Развёртывание на сервере 2.56.90.240

> Облачная среда разработки не может подключиться к серверу по SSH (порт 22 недоступен из песочницы), поэтому шаги
> ниже выполняет владелец или администратор на сервере. Каждый шаг идемпотентен. Первые два шага ничего не меняют
> на сервере.

## 0. Подключение и аудит (read-only)

```bash
ssh root@2.56.90.240
apt-get update && apt-get install -y git
git clone https://github.com/dadidkil/drago.git /opt/drago   # для приватного репо — deploy key или токен
cd /opt/drago
sudo bash infrastructure/scripts/00-server-audit.sh
```

Изучите отчёт `/root/drago-audit-*.txt`:

- заняты ли порты 80/443 — если там уже работают nginx или apache с сайтами, их нужно перенести за Caddy или
  остановить **после** бэкапа;
- объём RAM и диска: минимум 2 ГБ RAM (скрипт создаст swap) и 10 ГБ свободного места;
- открыт ли исходящий порт 25 и есть ли PTR — это влияет на выбор почты, см. [mail.md](mail.md).

## 1. Бэкап существующего

```bash
sudo bash infrastructure/scripts/01-backup-existing.sh
# скачайте архив к себе:
scp -r root@2.56.90.240:/root/pre-drago-backup-* ./
```

## 2. Подготовка сервера

```bash
sudo bash infrastructure/scripts/02-bootstrap.sh          # Docker, UFW, fail2ban, автообновления, swap, /srv/drago
```

Если на 80/443 работает старый веб-сервер, остановите его только после бэкапа и согласования:
`systemctl disable --now nginx` (или `apache2`).

## 3. DNS в REG.RU

Внесите записи из [dns-records.md](dns-records.md), раздел 1: `A @` и `A www` → 2.56.90.240. Проверка:
`dig +short dragotop.ru` должен вернуть IP сервера. Без этого Caddy не получит сертификат.

## 4. Секреты

```bash
bash infrastructure/scripts/gen-secrets.sh    # создаёт .env (600) со стойкими паролями
nano .env
```

Заполните:

| Переменная | Откуда взять |
|---|---|
| `ACME_EMAIL` | email для уведомлений Let's Encrypt |
| `SMTP_*`, `MAIL_FROM` | SMTP провайдера почты (см. [mail.md](mail.md)); без них приглашения не уходят — есть обходной путь со ссылкой |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | @BotFather (см. [bots.md](bots.md)) |
| `VK_GROUP_ID`, `VK_ACCESS_TOKEN`, `VK_CONFIRMATION_CODE` | настройки сообщества VK (см. [bots.md](bots.md)) |

`VK_CALLBACK_SECRET`, пароли БД и Redis, `APP_ENCRYPTION_KEY` уже сгенерированы. **Сохраните копию `.env` в
менеджере паролей.**

## 5. Запуск

```bash
make deploy        # = infrastructure/scripts/deploy.sh: сборка → миграции → запуск → healthcheck
make ps
```

Если Docker Hub недоступен из РФ, образы по умолчанию берутся с `mirror.gcr.io`. Переопределить можно в `.env`:
`NODE_IMAGE`, `POSTGRES_IMAGE`, `REDIS_IMAGE`, `CADDY_IMAGE`.

## 6. Первый администратор

```bash
make invite-admin email=alisa.denisova@example.com
```

Команда печатает одноразовую ссылку (72 часа). Откройте её, задайте пароль, затем:
`/admin` → система попросит включить 2FA → включите и сохраните резервные коды.
Дальше пользователи создаются из админки: `/admin/users/new`.

## 7. Ужесточение SSH (после проверки входа по ключу!)

```bash
# на своём компьютере:
ssh-keygen -t ed25519 -C "admin@dragotop"
ssh-copy-id root@2.56.90.240
ssh -o PasswordAuthentication=no root@2.56.90.240    # проверка в НОВОМ окне
# на сервере, не закрывая старую сессию:
sudo bash infrastructure/scripts/03-harden-ssh.sh
```

## 8. Боты, почта, контент

- Telegram и VK: [bots.md](bots.md).
- Почта: [mail.md](mail.md).
- Контент: `/admin/dashboard` → «Проверьте контент перед запуском», чек-лист в [research-drago.md](research-drago.md).

## Обновление

```bash
cd /opt/drago && make deploy          # git pull + пересборка + миграции (перед миграциями — автоматический бэкап)
```

Или через GitHub Actions: workflow **Deploy** (ручной запуск), секреты описаны в `.github/workflows/deploy.yml`.

## Откат

```bash
git log --oneline -5
bash infrastructure/scripts/deploy.sh <предыдущий-коммит>
# при несовместимой миграции — восстановление БД:
make restore f=/srv/drago/backups/daily/db-<время>.dump
```
