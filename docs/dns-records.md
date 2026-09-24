# DNS-записи для dragotop.ru (REG.RU)

Где редактировать: REG.RU → «Домены» → `dragotop.ru` → «DNS-серверы и управление зоной» → «Изменить».
Домен должен использовать DNS-серверы REG.RU (`ns1.reg.ru`, `ns2.reg.ru`), иначе записи вносятся у текущего DNS-провайдера.

Правила ввода в REG.RU:

- Поле «Субдомен»: `@` — сам домен, иначе только имя без домена (`www`, `mail`, `_dmarc`).
- TXT вводится **без кавычек**.
- Имена-цели (MX, CNAME) — полное имя; точку в конце REG.RU добавит сам.
- TTL: 3600, если не указано иное. Перед миграциями можно временно поставить 300.

IP сервера: **2.56.90.240**.

## 1. Сайт (обязательно)

| TYPE | HOST | VALUE | TTL |
|---|---|---|---|
| A | @ | 2.56.90.240 | 3600 |
| A | www | 2.56.90.240 | 3600 |
| CAA | @ | 0 issue "letsencrypt.org" | 3600 |
| CAA | @ | 0 iodef "mailto:admin@dragotop.ru" | 3600 |

> Если у VPS есть IPv6, добавьте `AAAA @` и `AAAA www`. Без работающего IPv6 на сервере AAAA не добавляйте — выпуск сертификата сломается.
> Если REG.RU не даёт завести CAA, пропустите эти записи: они повышают безопасность, но не обязательны.

## 2A. Почта на своём сервере (Stalwart)

| TYPE | HOST | VALUE | TTL |
|---|---|---|---|
| A | mail | 2.56.90.240 | 3600 |
| A | webmail | 2.56.90.240 | 3600 |
| A | autoconfig | 2.56.90.240 | 3600 |
| A | autodiscover | 2.56.90.240 | 3600 |
| MX | @ | mail.dragotop.ru (приоритет 10) | 3600 |
| TXT | @ | v=spf1 mx -all | 3600 |
| TXT | drago._domainkey | v=DKIM1; k=rsa; p=<ПУБЛИЧНЫЙ_КЛЮЧ_ИЗ_STALWART> | 3600 |
| TXT | _dmarc | v=DMARC1; p=none; rua=mailto:dmarc@dragotop.ru; adkim=s; aspf=s; pct=100 | 3600 |
| TXT | _smtp._tls | v=TLSRPTv1; rua=mailto:tlsrpt@dragotop.ru | 3600 |
| SRV | _submissions._tcp | 0 1 465 mail.dragotop.ru | 3600 |
| SRV | _submission._tcp | 0 1 587 mail.dragotop.ru | 3600 |
| SRV | _imaps._tcp | 0 1 993 mail.dragotop.ru | 3600 |

**PTR (обратная запись) настраивается НЕ в REG.RU, а у хостинг-провайдера VPS** — через панель или тикет в поддержку:
`2.56.90.240 → mail.dragotop.ru`.

Пояснения:

- SPF `v=spf1 mx -all`: отправлять почту домена может только сервер из MX. На время первых тестов можно поставить
  `~all`, но не оставляйте его надолго. **У домена должна быть только одна SPF-запись.**
- DKIM: ключ генерируется в Stalwart (Settings → DKIM, селектор `drago`, RSA-2048). Длинное значение REG.RU
  принимает целиком.
- DMARC: начинайте с `p=none` и собирайте отчёты. Через 2–4 недели без ошибок переходите на `p=quarantine`,
  затем на `p=reject`. Ящик `dmarc@dragotop.ru` нужно создать.

## 2B. Почта у managed-провайдера (рекомендуется)

**Точные значения берите из админки выбранного провайдера** — ниже типовые записи для сверки.

### Яндекс 360 для бизнеса

| TYPE | HOST | VALUE | TTL |
|---|---|---|---|
| TXT | @ | yandex-verification: <КОД_ИЗ_АДМИНКИ> | 3600 |
| MX | @ | mx.yandex.net (приоритет 10) | 3600 |
| TXT | @ | v=spf1 redirect=_spf.yandex.net | 3600 |
| TXT | mail._domainkey | v=DKIM1; k=rsa; t=s; p=<КЛЮЧ_ИЗ_АДМИНКИ_ЯНДЕКС_360> | 3600 |
| TXT | _dmarc | v=DMARC1; p=none; rua=mailto:dmarc@dragotop.ru | 3600 |
| A | webmail | 2.56.90.240 | 3600 |

### VK WorkSpace (Почта Mail.ru для бизнеса)

| TYPE | HOST | VALUE | TTL |
|---|---|---|---|
| TXT | @ | mailru-verification: <КОД_ИЗ_АДМИНКИ> | 3600 |
| MX | @ | emx.mail.ru (приоритет 10) | 3600 |
| TXT | @ | v=spf1 redirect=_spf.mail.ru | 3600 |
| TXT | mailru._domainkey | v=DKIM1; k=rsa; p=<КЛЮЧ_ИЗ_АДМИНКИ> | 3600 |
| TXT | _dmarc | v=DMARC1; p=none; rua=mailto:dmarc@dragotop.ru | 3600 |
| A | webmail | 2.56.90.240 | 3600 |

> `A webmail` ведёт на наш сервер: Caddy делает редирект на веб-почту провайдера (см. `docs/mail.md`, вариант B).

## 3. Проверка после внесения

```bash
dig +short A dragotop.ru
dig +short A www.dragotop.ru
dig +short CAA dragotop.ru
dig +short MX dragotop.ru
dig +short TXT dragotop.ru
dig +short TXT _dmarc.dragotop.ru
dig +short TXT drago._domainkey.dragotop.ru     # или mail._domainkey / mailru._domainkey
dig +short -x 2.56.90.240                        # PTR (вариант A)
```

Обычно записи начинают отвечать через 5–60 минут; с учётом TTL — до 24 часов.
