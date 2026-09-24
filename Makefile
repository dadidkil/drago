# ТОП «Драго» — частые команды эксплуатации (запускать из корня репозитория на сервере)
COMPOSE = docker compose --project-directory infrastructure -f infrastructure/docker-compose.yml --env-file .env
ifeq ($(WITH_MAIL),1)
COMPOSE += -f infrastructure/mail/docker-compose.mail.yml
endif

.PHONY: help audit backup-existing bootstrap secrets deploy up down ps logs migrate backup restore invite-admin reset-link shell-db preflight-mail

help:            ## Список команд
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

audit:           ## Read-only аудит сервера
	sudo bash infrastructure/scripts/00-server-audit.sh
backup-existing: ## Бэкап всего, что было на сервере до установки
	sudo bash infrastructure/scripts/01-backup-existing.sh
bootstrap:       ## Docker, UFW, fail2ban, swap, каталоги
	sudo bash infrastructure/scripts/02-bootstrap.sh
secrets:         ## Сгенерировать .env со стойкими секретами
	bash infrastructure/scripts/gen-secrets.sh
deploy:          ## Сборка, миграции, запуск, проверка здоровья
	bash infrastructure/scripts/deploy.sh
up:              ## Запустить все сервисы
	$(COMPOSE) up -d
down:            ## Остановить все сервисы (данные сохраняются)
	$(COMPOSE) down
ps:              ## Статус контейнеров
	$(COMPOSE) ps
logs:            ## Логи: make logs s=web
	$(COMPOSE) logs -f --tail=200 $(s)
migrate:         ## Применить миграции и сид
	$(COMPOSE) --profile tools run --rm migrate
backup:          ## Бэкап БД и файлов прямо сейчас
	$(COMPOSE) exec -T backup /bin/sh /backup/backup.sh once
restore:         ## Восстановление: make restore f=/srv/drago/backups/daily/db-....dump
	bash infrastructure/scripts/restore.sh $(f) $(u)
invite-admin:    ## Приглашение суперадмина: make invite-admin email=you@dragotop.ru
	$(COMPOSE) --profile tools run --rm migrate sh -c "pnpm exec tsx src/cli.ts invite-superadmin --email $(email)"
reset-link:      ## Ссылка сброса пароля: make reset-link email=user@example.com
	$(COMPOSE) --profile tools run --rm migrate sh -c "pnpm exec tsx src/cli.ts reset-link --email $(email)"
shell-db:        ## psql в контейнере БД
	$(COMPOSE) exec postgres sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'
preflight-mail:  ## Проверка готовности к self-hosted почте
	bash infrastructure/scripts/mail-preflight.sh $$(grep ^DOMAIN= .env | cut -d= -f2)
