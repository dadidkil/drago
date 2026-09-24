# Полный гайд по деплою ТОП «Драго»

Пошаговая инструкция развёртывания на VPS **с панелью ISPmanager и уже привязанным доменом `dragotop.ru`**.
Для чистого сервера без панели — [Приложение А](#приложение-а-сервер-без-ispmanager-caddy).

> Названия пунктов меню ISPmanager могут немного отличаться в зависимости от версии (5/6, Lite/Pro/Host).
> Там, где это важно, указано, что искать.

---

## Содержание

0. [Что получится и что подготовить](#0-что-получится-и-что-подготовить)
1. [Подключение к серверу](#1-подключение-к-серверу)
2. [Аудит сервера (ничего не меняет)](#2-аудит-сервера-ничего-не-меняет)
3. [Резервная копия того, что уже есть](#3-резервная-копия-того-что-уже-есть)
4. [Проверка домена и DNS](#4-проверка-домена-и-dns)
5. [Подготовка в ISPmanager: сайт, SSL, брандмауэр](#5-подготовка-в-ispmanager-сайт-ssl-брандмауэр)
6. [Установка Docker](#6-установка-docker)
7. [Код проекта](#7-код-проекта)
8. [Настройка `.env`](#8-настройка-env)
9. [Первый запуск](#9-первый-запуск)
10. [Подключение сайта к nginx ISPmanager](#10-подключение-сайта-к-nginx-ispmanager)
11. [Первый администратор и командный состав](#11-первый-администратор-и-командный-состав)
12. [Почта @dragotop.ru](#12-почта-dragotopru)
13. [Telegram-бот](#13-telegram-бот)
14. [VK-бот](#14-vk-бот)
15. [Контент перед открытием](#15-контент-перед-открытием)
16. [Безопасность после запуска](#16-безопасность-после-запуска)
17. [Приёмка: финальная проверка](#17-приёмка-финальная-проверка)
18. [Обновления, откат, бэкапы](#18-обновления-откат-бэкапы)
19. [Если что-то пошло не так](#19-если-что-то-пошло-не-так)
- [Приложение А. Сервер без ISPmanager (Caddy)](#приложение-а-сервер-без-ispmanager-caddy)
- [Приложение Б. Шпаргалка команд](#приложение-б-шпаргалка-команд)
- [Приложение В. Claude Code прямо на сервере](#приложение-в-claude-code-прямо-на-сервере)

---

## 0. Что получится и что подготовить

### Схема

```
Интернет ──443──▶ nginx ISPmanager (SSL Let's Encrypt от панели)
                    │  /etc/nginx/vhosts-resources/dragotop.ru/drago-proxy.conf
                    ├── /vk/callback ─────────▶ 127.0.0.1:3002  vk-bot   ┐
                    └── всё остальное ────────▶ 127.0.0.1:3000  web      │ Docker
                                                     worker, telegram-bot │ (docker compose)
                                                     PostgreSQL, Redis, backup ┘  ← без портов наружу
ISPmanager: почта (Exim/Dovecot/Roundcube), DNS (если NS у хостера), брандмауэр, панель :1500
```

- Сайт, кабинет, админка и боты работают в Docker. Наружу смотрит только nginx панели.
- ISPmanager остаётся хозяином портов 80/443, SSL-сертификатов, почты и брандмауэра. Конфиг сайта в панели мы
  **не редактируем**: подключаем свой файл через штатный каталог `vhosts-resources`. Поэтому изменения настроек сайта
  в панели наш прокси не затрут.

### Требования к серверу

| Ресурс | Минимум | Рекомендуется |
|---|---|---|
| ОС | Ubuntu 22.04/24.04 или Debian 11/12 | Ubuntu 24.04 |
| RAM | 2 ГБ (скрипт добавит swap) | 4 ГБ |
| Диск | 15 ГБ свободно | 30+ ГБ (фото, бэкапы) |
| CPU | 1 vCPU | 2 vCPU |

### Что подготовить заранее

- [ ] SSH-доступ: `root@2.56.90.240` (пароль или ключ).
- [ ] Логин администратора ISPmanager (`https://2.56.90.240:1500` или адрес из письма хостера).
- [ ] Доступ к REG.RU (домен `dragotop.ru`) — если DNS там.
- [ ] Email для уведомлений Let's Encrypt, например личная почта командира.
- [ ] Для ботов: аккаунт Telegram (создать бота) и права администратора сообщества https://vk.ru/top_drago.
- [ ] 1,5–3 часа на всё, плюс время на DNS и PTR (до суток).

**Порядок работы:** шаги 1–11 поднимают сайт и кабинет. Шаги 12–14 (почта, боты) можно делать позже — сайт работает
и без них.

---

## 1. Подключение к серверу

**Windows 10/11:** «Пуск» → «Терминал» (или PowerShell). **macOS/Linux:** «Терминал».

```bash
ssh root@2.56.90.240
```

При первом подключении подтвердите отпечаток ключа (`yes`) и введите пароль root.

Проверьте, что вы на нужном сервере и в какой ОС:

```bash
hostname; cat /etc/os-release | head -2; free -h; df -h /
```

> Все команды ниже выполняются **на сервере** от `root`, если не сказано иное.

---

## 2. Аудит сервера (ничего не меняет)

Установите git и скачайте проект:

```bash
apt-get update && apt-get install -y git
git clone https://github.com/dadidkil/drago.git /opt/drago
cd /opt/drago
git checkout claude/amazing-maxwell-xkzunz     # или main — после слияния ветки
```

Запустите аудит — скрипт только читает:

```bash
bash infrastructure/scripts/00-server-audit.sh
```

Отчёт сохранится в `/root/drago-audit-<дата>.txt`. На что смотреть:

| Раздел отчёта | Что должно быть | Если не так |
|---|---|---|
| Ресурсы | RAM ≥ 2 ГБ, диск ≥ 15 ГБ свободно | увеличить тариф или почистить диск |
| Панель управления | `ISPmanager: УСТАНОВЛЕН`, сайт `dragotop.ru` есть в списке сайтов (webdomain) | создать сайт (шаг 5.1) |
| Открытые порты | 80/443 слушает **nginx**, 1500 — ISPmanager (ihttpd), 3000/3002 свободны | если 3000/3002 заняты — задать другие `WEB_PORT`/`VK_BOT_PORT` в `.env` |
| Docker | установлен или нет | будет установлен на шаге 6 |
| DNS домена | `A dragotop.ru` = 2.56.90.240 | шаг 4 |
| Почта | `Исходящий порт 25 → ОТКРЫТ` | если закрыт — запросить у хостера или выбрать внешнюю почту (шаг 12) |
| PTR | `2.56.90.240 → mail.dragotop.ru` | запросить у хостера (шаг 12) |

Сохраните отчёт себе: `scp root@2.56.90.240:/root/drago-audit-*.txt .` — команда запускается на **вашем** компьютере.

---

## 3. Резервная копия того, что уже есть

```bash
bash infrastructure/scripts/01-backup-existing.sh
```

Скрипт копирует `/etc` (nginx, ssh, letsencrypt…), `/var/www`, дампы баз MySQL/PostgreSQL (если есть) и тома Docker
в `/root/pre-drago-backup-<дата>/`. Ничего не удаляет и не останавливает.

Дополнительно в ISPmanager: **Резервные копии** → создать копию сейчас, если функция включена у хостера.

Скачайте архив к себе (команда на **вашем** компьютере):

```bash
scp -r root@2.56.90.240:/root/pre-drago-backup-* ./
```

---

## 4. Проверка домена и DNS

Выясните, **где управляется DNS** домена:

```bash
dig +short NS dragotop.ru
dig +short A dragotop.ru
dig +short A www.dragotop.ru
```

| Результат `NS` | Где редактировать DNS-записи |
|---|---|
| `ns1.reg.ru`, `ns2.reg.ru` | REG.RU → Домены → dragotop.ru → «DNS-серверы и управление зоной» |
| NS хостера или сервера (`ns1.<хостер>`, `ns1.dragotop.ru`) | ISPmanager → **Доменные имена** (DNS) → dragotop.ru → Записи |

Для сайта нужны записи `A @ → 2.56.90.240` и `A www → 2.56.90.240`. Если домен «привязан» у хостера, они обычно
уже есть — проверьте, что `dig` возвращает правильный IP. Полный список записей, включая почту, —
[dns-records.md](dns-records.md).

---

## 5. Подготовка в ISPmanager: сайт, SSL, брандмауэр

Откройте панель: `https://2.56.90.240:1500` (или адрес от хостера), войдите администратором.

### 5.1. Сайт dragotop.ru

**Сайты** (в ISPmanager 5 — «WWW-домены») → `dragotop.ru` → **Изменить**:

- **Имя:** `dragotop.ru`, **псевдонимы:** `www.dragotop.ru`.
- **Обработчик:** «Без обработчика» / отключить PHP. PHP сайту не нужен, и так nginx не будет отдавать PHP-скрипты
  из каталога сайта. Если оставить PHP, наш прокси всё равно перехватит все запросы, но отключить надёжнее.
- **Перенаправлять HTTP на HTTPS:** включить.
- Каталог сайта (`/var/www/.../dragotop.ru`) можно оставить пустым: контент отдаёт приложение.

Если сайта нет — **Сайты → Создать** с этими же параметрами.

### 5.2. SSL-сертификат

**Сначала проверьте DNS:** `dig +short dragotop.ru` и `dig +short www.dragotop.ru` должны вернуть IP **этого**
сервера (`curl -4 -s ifconfig.me`). Иначе Let's Encrypt пойдёт на другой сервер и выдаст ошибку «Invalid response …
/.well-known/acme-challenge/…: 404». На 24.09.2026 обе записи указывали на `95.163.244.138`, а не на 2.56.90.240 —
исправьте их в REG.RU (шаг 4) и подождите 15–60 минут (TTL записей был 6 часов).

**SSL-сертификаты → Создать → Let's Encrypt** → домены `dragotop.ru` и `www.dragotop.ru`. Затем в настройках сайта
включите **SSL** и выберите этот сертификат. Панель сама продлевает сертификат.

Проверка: `https://dragotop.ru` открывается без предупреждения браузера. Пока там заглушка ISPmanager или пустой
каталог — это нормально.

### 5.3. Брандмауэр

В ISPmanager: **Брандмауэр** (в разделе «Сеть» или «Инструменты»). **UFW на сервере с панелью не используем.**

| Порт | Правило | Зачем |
|---|---|---|
| 22/tcp (или ваш порт SSH) | разрешить | SSH — **проверьте, прежде чем что-то запрещать** |
| 80/tcp, 443/tcp | разрешить | сайт |
| 1500/tcp | разрешить **только с ваших IP** | панель ISPmanager |
| 25, 465, 587, 993/tcp | разрешить | только если почта на этом сервере (шаг 12) |
| 3000, 3002, 5432, 6379 | **не открывать** | приложение слушает только 127.0.0.1, база и Redis вообще без портов |
| всё остальное | запретить | |

Если почтовые ящики создаются из нашей админки через API панели (шаг 12, `MAIL_PROVIDER=ispmanager`), разрешите
также **1500/tcp с адресов `172.16.0.0/12`** — это внутренняя сеть Docker.

---

## 6. Установка Docker

```bash
cd /opt/drago
bash infrastructure/scripts/02-bootstrap.sh
```

Скрипт сам видит ISPmanager и в этом режиме:

- ставит Docker Engine и docker compose из официального репозитория;
- **не трогает файрвол** (UFW пропускается — правила задаются в ISPmanager);
- включает fail2ban для SSH и автообновления безопасности;
- при RAM < 3 ГБ добавляет swap 2 ГБ;
- создаёт `/srv/drago/uploads` (загруженные файлы) и `/srv/drago/backups` (бэкапы).

Проверка:

```bash
docker version --format '{{.Server.Version}}'
docker compose version
```

> **ISPmanager Pro/Host** умеет ставить Docker сам: «Настройки → Конфигурация ПО → Docker». Используйте что-то одно:
> если Docker уже поставлен панелью, скрипт это увидит и не будет ставить повторно.

> **Важно про брандмауэр ISPmanager и Docker.** После изменения правил в брандмауэре панели перезапустите Docker:
> `systemctl restart docker`. Иначе контейнеры могут потерять выход в интернет (перестанут уходить уведомления
> в Telegram и письма). Контейнеры поднимаются сами за 10–20 секунд.

---

## 7. Код проекта

Проект уже склонирован в `/opt/drago` на шаге 2. Убедитесь, что вы на нужной ветке и в актуальном состоянии:

```bash
cd /opt/drago
git status
git pull
```

---

## 8. Настройка `.env`

```bash
cd /opt/drago
bash infrastructure/scripts/gen-secrets.sh
nano .env
```

`gen-secrets.sh` создаёт `.env` с правами 600 и сам генерирует пароли PostgreSQL и Redis, `APP_ENCRYPTION_KEY` и
`VK_CALLBACK_SECRET`. Заполните вручную:

| Переменная | Значение | Обязательно на старте |
|---|---|---|
| `REVERSE_PROXY` | `ispmanager` (уже стоит) | да |
| `DOMAIN` / `APP_URL` | `dragotop.ru` / `https://dragotop.ru` (уже стоят) | да |
| `ACME_EMAIL` | любой ваш email (в режиме ISPmanager не используется, но должен быть задан) | да |
| `WEB_PORT`, `VK_BOT_PORT` | `3000`, `3002` — поменять, только если порты заняты | да |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | ящик для писем сайта (шаг 12.4) | нет — без них приглашения выдаются ссылкой в админке |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | шаг 13 | нет |
| `VK_GROUP_ID`, `VK_ACCESS_TOKEN`, `VK_CONFIRMATION_CODE` | шаг 14 | нет |
| `MAIL_PROVIDER` и `ISPMANAGER_*` | шаг 12 | нет (`manual` по умолчанию) |

Сохраните в nano: `Ctrl+O`, `Enter`, `Ctrl+X`.

**Сохраните копию `.env` в менеджере паролей** (KeePass, Bitwarden и т. п.). `APP_ENCRYPTION_KEY` нельзя менять
после запуска: им зашифрованы секреты 2FA.

---

## 9. Первый запуск

```bash
cd /opt/drago
tmux new -s deploy        # деплой переживёт обрыв SSH; вернуться: tmux attach -t deploy
make deploy
```

Весь вывод дублируется в лог `/var/log/drago/deploy-<время>.log`. Перед сборкой скрипт проверяет, что свободно
≥ 6 ГБ диска и ≥ 1,5 ГБ памяти (RAM + swap): иначе сборка может заполнить диск или вызвать нехватку памяти.

Что происходит:

1. Сборка Docker-образов — 5–15 минут в первый раз. Базовые образы берутся с `mirror.gcr.io`, так как Docker Hub
   из РФ бывает недоступен.
2. Запуск PostgreSQL и Redis.
3. Миграции базы и начальное заполнение: роли, права, настройки, проверенный контент.
4. Запуск web, worker, telegram-bot, vk-bot, backup.
5. Проверка здоровья.

Ожидаемый конец вывода:

```
▶ Режим: ispmanager
...
✅ приложение отвечает на 127.0.0.1:3000
⚠ https://dragotop.ru не отвечает: выполните sudo bash infrastructure/ispmanager/install-nginx-proxy.sh dragotop.ru ...
```

Предупреждение про https на этом этапе нормально: nginx панели подключаем на следующем шаге.

Проверка:

```bash
make ps                                   # все сервисы Up, web/worker/vk-bot — (healthy)
curl -s http://127.0.0.1:3000/api/health  # {"status":"ok"}
```

---

## 10. Подключение сайта к nginx ISPmanager

```bash
cd /opt/drago
make nginx-proxy
# то же самое: sudo bash infrastructure/ispmanager/install-nginx-proxy.sh dragotop.ru
```

Скрипт:

1. находит конфиг сайта в `/etc/nginx/vhosts/…/dragotop.ru.conf`;
2. находит в нём `include /etc/nginx/vhosts-resources/<сайт>/*.conf` и кладёт туда `drago-proxy.conf`;
3. проверяет `nginx -t` и перезагружает nginx; при ошибке — откатывает.

Проверка:

```bash
curl -sI https://dragotop.ru | head -5            # HTTP/2 200 и заголовки content-security-policy, strict-transport-security
curl -s https://dragotop.ru/api/health            # {"status":"ok"}
curl -sI http://dragotop.ru | grep -i location    # 301 → https://
```

Откройте `https://dragotop.ru` в браузере — должна открыться главная «ТОП Драго».

### Как это устроено (для администратора)

`drago-proxy.conf` работает на уровне `server {}`:

- все запросы по HTTPS внутренне перенаправляются в служебные `location` и проксируются в `127.0.0.1:3000`
  (`/vk/callback` — в `127.0.0.1:3002`) с исходным `$request_uri`;
- `location /` панели не трогается — поэтому regex-правила ISPmanager для `*.js`, `*.css` и картинок не перехватывают
  файлы приложения;
- `/.well-known/acme-challenge/` (продление сертификата), `/roundcube`, `/webmail`, `/phpmyadmin` остаются за
  ISPmanager;
- `X-Forwarded-For` перезаписывается адресом клиента: подделать IP для обхода лимитов нельзя.

Схема проверена на nginx 1.30 с конфигом сайта в формате ISPmanager.

### Если скрипт не нашёл include (ручной вариант)

```bash
grep -rl "dragotop.ru" /etc/nginx/vhosts/          # файл сайта
grep -n "include" /etc/nginx/vhosts/*/dragotop.ru.conf
```

- Если `include /etc/nginx/vhosts-resources/…` есть — скопируйте файл вручную:
  ```bash
  mkdir -p /etc/nginx/vhosts-resources/dragotop.ru
  cp infrastructure/ispmanager/nginx-drago-proxy.conf /etc/nginx/vhosts-resources/dragotop.ru/drago-proxy.conf
  nginx -t && systemctl reload nginx
  ```
- Если такого include нет (старая версия панели): ISPmanager → **Сайты → dragotop.ru → Конфигурационные файлы**
  (nginx). Добавьте в оба блока `server` (80 и 443), до первого `location`, строку:
  `include /opt/drago/infrastructure/ispmanager/nginx-drago-proxy.conf;`
  Затем сохраните и выполните `nginx -t`. Этот вариант может сбрасываться при изменении настроек сайта в панели —
  после таких изменений проверяйте, что строка осталась.

---

## 11. Первый администратор и командный состав

```bash
cd /opt/drago
make invite-admin email=ВАШ_EMAIL
```

Команда выведет одноразовую ссылку (действует 72 часа):

1. откройте её, задайте пароль (≥ 10 символов, буквы и цифры) — вы в кабинете;
2. откройте `https://dragotop.ru/admin` — система попросит включить **2FA**;
3. в приложении-аутентификаторе (Яндекс Ключ, Google Authenticator, Aegis…) отсканируйте QR, введите код;
4. **сохраните 8 резервных кодов** — например, распечатайте или положите в менеджер паролей.

Дальше: `/admin/users/new` → командир, комиссар, командный состав, бойцы. Каждому уходит приглашение на email.
Если SMTP ещё не настроен, на странице пользователя есть кнопка «Показать ссылку-приглашение» — передайте ссылку лично.

Роли: SUPERADMIN (технический админ), COMMANDER, COMMISSAR, STAFF, FIGHTER, CANDIDATE — подробно в [rbac.md](rbac.md).

---

## 12. Почта @dragotop.ru

На сервере с ISPmanager уже есть почтовый сервер панели (Exim + Dovecot + Roundcube). Варианты и их сравнение —
[mail.md](mail.md). Коротко:

- **C. Почта ISPmanager** (рекомендуется для этого сервера) — ящики создаются **автоматически из нашей админки**
  через API панели. Нужны открытый порт 25 и PTR от хостера.
- **B. Яндекс 360 / VK WorkSpace** — если хостер не даёт порт 25 или PTR либо письма попадают в спам.

### 12.1. PTR и порт 25 (запрос хостеру)

Напишите в поддержку хостинга:

> Прошу настроить PTR (обратную DNS-запись) для IP 2.56.90.240 → `mail.dragotop.ru` и подтвердить, что исходящий
> порт 25 открыт.

Проверка после ответа: `make preflight-mail` (пункты 1–3).

### 12.2. Почтовый домен в ISPmanager

1. **Сайты → Создать** `mail.dragotop.ru` (без обработчика) и выпустите для него Let's Encrypt (как в 5.2) — этот
   сертификат нужен для IMAP/SMTP. Если DNS у REG.RU, сначала добавьте `A mail → 2.56.90.240`.
2. **Почта → Почтовые домены → Создать:** имя `dragotop.ru`; включите **DKIM**, антиспам и greylisting, если они
   есть; SSL-сертификат — `mail.dragotop.ru`.
3. **DNS:**
   - если DNS в ISPmanager, панель сама добавит MX, SPF и DKIM — проверьте их в «Доменные имена → dragotop.ru →
     Записи» и добавьте DMARC;
   - если DNS у REG.RU, внесите записи вручную по [dns-records.md](dns-records.md), раздел «2C»; DKIM-ключ скопируйте
     из панели (почтовый домен → DKIM / «Записи»).

### 12.3. Автоматическое создание ящиков из админки

1. **Пользователь для API** — не используйте root. Лучше всего использовать владельца почтового домена
   (пользователя, под которым создан сайт и почтовый домен). Можно создать отдельного пользователя, например
   `drago-mail`, и создать почтовый домен от его имени.
2. В `.env`:
   ```
   MAIL_PROVIDER=ispmanager
   MAIL_DOMAIN=dragotop.ru
   ISPMANAGER_URL=https://host.docker.internal:1500
   ISPMANAGER_USER=<пользователь панели>
   ISPMANAGER_PASSWORD=<его пароль>
   ISPMANAGER_TLS_VERIFY=false
   ```
   `TLS_VERIFY=false` допустим: запрос идёт внутри сервера на самоподписанный сертификат панели. Если у панели
   валидный сертификат и вы указываете `https://<домен-панели>:1500`, ставьте `true`.
3. Брандмауэр ISPmanager: разрешить 1500/tcp с `172.16.0.0/12` (шаг 5.3), затем `systemctl restart docker`.
4. `make deploy`, затем `/admin/integrations` → «Почтовые ящики: OK — ISPmanager API доступен, почтовый домен
   dragotop.ru найден».
5. `/admin/mail` → выбрать бойца → адрес предложится как `имя.фамилия` → «Создать ящик». Боец получит уведомление,
   а **временный пароль увидит только он**, один раз, в кабинете → «Почта».

### 12.4. Письма сайта (приглашения, сброс пароля, уведомления)

1. ISPmanager → **Почта → Почтовые ящики → Создать** `noreply@dragotop.ru` со сложным паролем. Можно создать и
   из нашей админки, но тогда пароль увидит только владелец аккаунта, поэтому для служебного ящика удобнее панель.
2. В `.env`:
   ```
   SMTP_HOST=mail.dragotop.ru
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=noreply@dragotop.ru
   SMTP_PASSWORD=<пароль ящика>
   MAIL_FROM="ТОП «Драго» <noreply@dragotop.ru>"
   ```
3. `make deploy` → `/admin/integrations` → «Отправить тестовое письмо себе».

### 12.5. Веб-почта

Roundcube ISPmanager доступен по адресу `https://dragotop.ru/roundcube/`: наш прокси этот путь не перехватывает.
Укажите его в `/admin/settings` → «Корпоративная почта» → «Веб-почта», и ссылка появится у бойцов в кабинете.

### 12.6. Проверка доставки — обязательно

Сначала `DKIM_SELECTOR=<селектор из ISPmanager> make preflight-mail`. Затем — чек-лист из [mail.md](mail.md#проверка--почта-не-считается-рабочей-пока-всё-не-отмечено):

- SPF, DKIM и DMARC = pass;
- письма доходят на Gmail, Яндекс и Mail.ru, и обратно;
- mail-tester ≥ 9/10.

---

## 13. Telegram-бот

1. В Telegram откройте **@BotFather** → `/newbot` → имя «ТОП Драго» → username, например `drago_top_bot`.
2. Скопируйте токен в `.env`: `TELEGRAM_BOT_TOKEN=...`, `TELEGRAM_BOT_USERNAME=drago_top_bot`.
3. В @BotFather: `/setjoingroups` → Disable; `/setdescription`, `/setuserpic` — по желанию.
4. `make deploy` → `/admin/integrations` → «Бот @drago_top_bot отвечает».
5. Проверка: кабинет → «Безопасность» → «Подключить Telegram» → открыть ссылку → Start → «Telegram привязан ✅».

Бот работает в режиме long polling: входящий порт и webhook не нужны. Подробно — [bots.md](bots.md).

---

## 14. VK-бот

В сообществе https://vk.ru/top_drago (нужны права администратора):

1. **Управление → Сообщения** → включить. **Настройки для бота → Возможности ботов** → включить, «Кнопка „Начать“» →
   включить.
2. **Управление → Работа с API → Ключи доступа** → создать ключ с правом «Сообщения сообщества» →
   `.env: VK_ACCESS_TOKEN=...`.
3. **Работа с API → Callback API**:
   - версия API **5.199**;
   - адрес: `https://dragotop.ru/vk/callback`;
   - «Строка, которую должен вернуть сервер» → `.env: VK_CONFIRMATION_CODE=...`;
   - «Секретный ключ»: значение `VK_CALLBACK_SECRET` из `.env` — посмотреть: `grep VK_CALLBACK_SECRET .env`;
   - `VK_GROUP_ID` — числовой ID сообщества (показан на этой же странице).
4. `make deploy`, затем в VK нажмите **«Подтвердить»** — должно появиться «Адрес успешно подтверждён».
5. **Типы событий:** «Входящее сообщение», «Разрешение на получение», «Запрет на получение».
6. Проверка: напишите сообществу «Начать» — придёт меню; «Вступить» → анкета → заявка в `/admin/applications`.

---

## 15. Контент перед открытием

`/admin/dashboard` → блок «Проверьте контент перед запуском». Минимум:

- [ ] `/admin/pages/contacts` — официальные контакты, ссылки на VK и Telegram, текст о наборе;
- [ ] `/admin/pages/page/history` и `traditions` — заполнить и опубликовать (сейчас черновики);
- [ ] `/admin/pages/projects` — подтвердить проекты, черновики «A4 Kids City» и «Вокзалы РЖД» опубликовать или удалить;
- [ ] `/admin/pages/team` — фото командира и комиссара (с их согласия);
- [ ] `/admin/gallery` — альбомы (фото несовершеннолетних — только с согласия родителей);
- [ ] `/admin/documents` → «Методички» — загрузить «Методическое пособие для конкурсных мероприятий» (видно только бойцам);
- [ ] `/admin/pages/page/privacy` — согласовать политику обработки ПДн с ответственным лицом организации;
- [ ] сверить девиз ТОП Москвы в разделе «РСО и ТОП Москвы» (`/admin/pages/page/rso`).

Подробности и источники — [research-drago.md](research-drago.md).

---

## 16. Безопасность после запуска

### 16.1. SSH только по ключу

На **вашем** компьютере:

```bash
ssh-keygen -t ed25519 -C "drago-admin"        # задайте парольную фразу
ssh-copy-id root@2.56.90.240                   # Windows: type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@2.56.90.240 "cat >> ~/.ssh/authorized_keys"
ssh -o PasswordAuthentication=no root@2.56.90.240   # проверка в НОВОМ окне
```

Только после успешной проверки, **не закрывая старую сессию**:

```bash
cd /opt/drago && bash infrastructure/scripts/03-harden-ssh.sh
```

Откат, если что-то пошло не так (из старой сессии):
`rm /etc/ssh/sshd_config.d/99-drago-hardening.conf && systemctl reload ssh`.

### 16.2. Панель ISPmanager

- Порт 1500 открыт только с ваших IP (брандмауэр панели).
- Сложный пароль администратора; если версия поддерживает — двухфакторная аутентификация в настройках пользователя.
- Отдельный пользователь панели для почтового API (шаг 12.3), без прав root.

### 16.3. Бэкапы за пределы сервера

Бэкапы делаются ежедневно в `/srv/drago/backups`: 14 дней, 8 недель, 6 месяцев. **Копируйте их на другой
компьютер или в облако** — в них персональные данные, поэтому храните зашифрованными. Например, cron на вашем
компьютере:

```bash
rsync -a root@2.56.90.240:/srv/drago/backups/ ~/drago-backups/
```

### 16.4. Мониторинг

Подключите бесплатный внешний мониторинг (UptimeRobot, Яндекс Мониторинг и т. п.) на
`https://dragotop.ru/api/health` с уведомлением в Telegram.

### 16.5. 152-ФЗ

Проверьте у хостера, что сервер физически находится в РФ: в системе хранятся персональные данные граждан РФ,
в том числе несовершеннолетних. Остальное — в [security.md](security.md).

---

## 17. Приёмка: финальная проверка

| # | Проверка | Как | Ожидаемо |
|---|---|---|---|
| 1 | Сайт по HTTPS | открыть https://dragotop.ru | главная «ТОП Драго», замок в браузере |
| 2 | Редирект | http://dragotop.ru, https://www.dragotop.ru | → https://dragotop.ru |
| 3 | Заголовки безопасности | `curl -sI https://dragotop.ru` | `content-security-policy`, `strict-transport-security`, `x-frame-options: DENY` |
| 4 | Здоровье | `curl https://dragotop.ru/api/health` | `{"status":"ok"}` |
| 5 | Порты | `ss -tlnp` (на сервере) | 3000/3002 только на 127.0.0.1; 5432/6379 не видны |
| 6 | Снаружи порты закрыты | с вашего ПК: `nc -zv 2.56.90.240 3000` и `5432` | отказ или таймаут |
| 7 | Вход и 2FA | вход администратора | запрос кода 2FA |
| 8 | Заявка | https://dragotop.ru/join → отправить | появилась в `/admin/applications`, пришло уведомление |
| 9 | Загрузка фото | `/admin/gallery` → альбом → фото | фото на сайте в `/gallery` |
| 10 | Документ | `/admin/documents` → загрузить PDF → скачать в кабинете бойца | открывается у бойца; без входа — 401 |
| 11 | Бэкап | `make backup && ls -la /srv/drago/backups/daily` | свежие `db-*.dump` и `uploads-*.tar.gz` |
| 12 | Письма | `/admin/integrations` → тестовое письмо | во «Входящих», не в спаме |
| 13 | Telegram | привязка из кабинета, создать задачу на себя | уведомление в Telegram |
| 14 | VK | «Начать» в сообщениях сообщества | меню бота |
| 15 | Почта ящиков | `/admin/mail` → создать ящик → вход в Roundcube с временным паролем | вход успешен |
| 16 | Перезагрузка сервера | `reboot` | через 1–2 минуты всё работает само |

---

## 18. Обновления, откат, бэкапы

**Обновление** (перед миграциями автоматически делается бэкап):

```bash
cd /opt/drago && make deploy
```

Или через GitHub Actions: workflow **Deploy** (ручной запуск). Секреты описаны в `.github/workflows/deploy.yml`.

**Откат кода:**

```bash
git log --oneline -10
bash infrastructure/scripts/deploy.sh <хэш-предыдущего-коммита>
```

**Восстановление базы и файлов:**

```bash
ls -la /srv/drago/backups/daily/
make restore f=/srv/drago/backups/daily/db-ГГГГММДД-ЧЧММ.dump u=/srv/drago/backups/daily/uploads-ГГГГММДД-ЧЧММ.tar.gz
```

**Логи:** `make logs s=web` (или `worker`, `telegram-bot`, `vk-bot`, `postgres`). Логи nginx панели:
`/var/www/httpd-logs/dragotop.ru.*.log`.

---

## 19. Если что-то пошло не так

| Симптом | Причина | Что делать |
|---|---|---|
| **502 Bad Gateway** | контейнер web не запущен или порт другой | `make ps`, `make logs s=web`; `curl http://127.0.0.1:3000/api/health`; сверить `WEB_PORT` в `.env` и в `drago-proxy.conf` |
| Открывается заглушка ISPmanager / «Index of» | прокси не подключён или SSL у сайта выключен | `make nginx-proxy`; включить SSL сайта (5.2); `nginx -T \| grep drago` |
| `nginx -t` падает после установки | конфликт с кастомными правилами сайта | скрипт откатит сам; проверьте, нет ли своих `rewrite` в конфиге сайта; ручной вариант — шаг 10 |
| Let's Encrypt: «Invalid response from http://dragotop.ru/.well-known/acme-challenge/…: 404» (в сообщении чужой IP) | A-запись домена указывает на другой сервер | IP в сообщении — куда ходил Let's Encrypt. Сверить с `curl -4 -s ifconfig.me`; исправить `A @` и `A www` в REG.RU; подождать до TTL; повторить |
| Сертификат не продлевается | закрыт 80 порт или удалён `.well-known` | 80/tcp открыт в брандмауэре; путь `/.well-known/acme-challenge/` наш прокси не трогает |
| «Forbidden: cross-origin request» при отправке форм | запрос пришёл с другого домена или прокси не передаёт `Host` | открывать сайт строго по `https://dragotop.ru`; в `drago-proxy.conf` должны быть `Host $host` и `X-Forwarded-Host $host` |
| Не уходят уведомления в Telegram/VK, письма | контейнеры без интернета после изменения брандмауэра | `systemctl restart docker`; `make logs s=worker` |
| Письма в спаме / не доходят | нет PTR, SPF, DKIM, DMARC, IP в блок-листе | `make preflight-mail`; [mail.md](mail.md) |
| `/admin/integrations`: ISPmanager API недоступен | 1500 закрыт для Docker, неверный пароль | брандмауэр: 1500 для `172.16.0.0/12` + `systemctl restart docker`; проверить `ISPMANAGER_USER/PASSWORD` |
| VK: «Не удалось подтвердить адрес» | не совпадает строка подтверждения, секрет или ID группы | сверить `VK_CONFIRMATION_CODE`, `VK_CALLBACK_SECRET`, `VK_GROUP_ID`; `make logs s=vk-bot` («bad secret» / «wrong group_id») |
| Telegram-бот молчит | нет токена или токен неверный | `make logs s=telegram-bot`; `/admin/integrations` |
| Сборка падает на скачивании образов | Docker Hub или зеркало недоступно | в `.env` задать другое зеркало: `NODE_IMAGE=public.ecr.aws/docker/library/node:22-bookworm-slim`, аналогично `POSTGRES_IMAGE`, `REDIS_IMAGE` |
| Кончилось место | логи, бэкапы, кэш сборки | `df -h`; `docker system df`; `docker builder prune -f`; `docker image prune -f`; проверить `/srv/drago/backups` |
| SSH оборвался во время `make deploy` («closed by remote host») | нехватка памяти/диска при сборке или перезагрузка сервера | переподключиться; `uptime`, `free -h`, `df -h /`, `dmesg -T \| grep -i -E "oom\|killed" \| tail`; последний лог — `ls -t /var/log/drago/ \| head -1`; запускать деплой в `tmux`; при нехватке памяти — swap (`02-bootstrap.sh`) |
| Потерян доступ администратора | забыт пароль или 2FA | `make reset-link email=...` (ссылка сброса); сброс 2FA — другой администратор в `/admin/users` |

---

## Приложение А. Сервер без ISPmanager (Caddy)

Если панели нет, порты 80/443 займёт Caddy из docker-compose: он сам получит сертификаты Let's Encrypt.

1. Шаги 1–4 (аудит, бэкап, DNS: `A @` и `A www` → IP сервера).
2. `bash infrastructure/scripts/02-bootstrap.sh` — поставит Docker, **UFW** (SSH, 80, 443), fail2ban.
3. `bash infrastructure/scripts/gen-secrets.sh`; в `.env`: **`REVERSE_PROXY=caddy`**, `ACME_EMAIL=...`.
4. Если на 80/443 работает старый nginx или apache — после бэкапа остановить его: `systemctl disable --now nginx`.
5. `make deploy` → `https://dragotop.ru` работает. Шаг 10 не нужен.
6. Шаги 11–18 — как выше. Почта — варианты A (Stalwart, `infrastructure/mail/`) или B (managed), см. [mail.md](mail.md).

---

## Приложение Б. Шпаргалка команд

```bash
cd /opt/drago
make help                               # все команды
make ps                                 # статус контейнеров
make logs s=web                         # логи (web, worker, telegram-bot, vk-bot, postgres, backup)
make deploy                             # обновление: pull → сборка → бэкап → миграции → запуск
make nginx-proxy                        # (ISPmanager) переподключить прокси nginx
make backup                             # бэкап сейчас
make restore f=... u=...                # восстановление
make invite-admin email=...             # приглашение суперадмина
make reset-link email=...               # ссылка сброса пароля
make shell-db                           # консоль PostgreSQL
make preflight-mail                     # проверка DNS/PTR/порта 25 для почты
systemctl restart docker                # после изменения брандмауэра ISPmanager
```

---

## Приложение В. Claude Code прямо на сервере

Облачная сессия Claude не может подключиться к серверу по SSH. Чтобы Claude выполнял деплой сам, запустите
Claude Code **на сервере** и управляйте им из приложения Claude (Remote Control):

```bash
ssh root@2.56.90.240
curl -fsSL https://claude.ai/install.sh | bash
apt-get install -y tmux git
[ -d /opt/drago ] || git clone https://github.com/dadidkil/drago.git /opt/drago
cd /opt/drago && git checkout claude/amazing-maxwell-xkzunz && git pull
tmux new -s claude            # сессия переживёт обрыв SSH; вернуться: tmux attach -t claude
claude remote-control         # при первом запуске — вход в аккаунт по ссылке
```

Сессия появится в приложении Claude Code. Контекст проекта и правила безопасности она возьмёт из `CLAUDE.md` в корне
репозитория: что делать сама, а что — только после вашего подтверждения.

Что по-прежнему делаете вы:

- DNS в REG.RU;
- PTR и порт 25 — у хостера;
- @BotFather и настройки VK;
- 2FA на своём телефоне;
- подтверждения рискованных действий: удаление, брандмауэр, SSH, перезагрузка.

Сессия на сервере имеет полный доступ к нему. Не включайте режим без подтверждений и завершайте её, когда работа
закончена: `Ctrl+C`, затем `exit` из tmux.
