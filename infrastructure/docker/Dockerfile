# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Единый multi-stage Dockerfile монорепозитория ТОП «Драго».
# Цели (target): web, worker, telegram-bot, vk-bot, migrate.
# Базовый образ параметризован: Docker Hub из РФ бывает недоступен — по умолчанию зеркало.
# ─────────────────────────────────────────────────────────────────────────────
ARG NODE_IMAGE=mirror.gcr.io/library/node:22-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    CI=1
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo

# ── Зависимости (кэшируется, пока не меняются package.json / lockfile) ──────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY apps/telegram-bot/package.json apps/telegram-bot/
COPY apps/vk-bot/package.json apps/vk-bot/
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
COPY packages/core/package.json packages/core/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

# ── Сборка всего ─────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN pnpm db:generate \
 && pnpm --filter @drago/web build \
 && pnpm --filter @drago/worker --filter @drago/telegram-bot --filter @drago/vk-bot build
# Production-зависимости для сервисов (workspace-код уже встроен в бандлы tsup)
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    for app in worker telegram-bot vk-bot; do \
      pnpm --filter "@drago/$app" deploy --prod --legacy "/out/$app" && cp -r "apps/$app/dist" "/out/$app/dist"; \
    done

# ── Миграции и сид (одноразовый контейнер) ───────────────────────────────────
FROM build AS migrate
WORKDIR /repo/packages/database
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm exec tsx src/seed.ts"]

# ── Общий runtime ────────────────────────────────────────────────────────────
# Без apt-get: init-процесс даёт Docker (`init: true` в compose), healthcheck — через fetch в Node.
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
USER node

# ── Сайт, кабинет, админка (Next.js standalone) ──────────────────────────────
FROM runtime AS web
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
ENV PORT=3000 HOSTNAME=0.0.0.0
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]

FROM runtime AS worker
COPY --from=build --chown=node:node /out/worker ./
HEALTHCHECK --interval=60s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "const s=require('fs').statSync('/tmp/worker-heartbeat');process.exit(Date.now()-s.mtimeMs<120000?0:1)"
CMD ["node", "--enable-source-maps", "dist/index.js"]

FROM runtime AS telegram-bot
COPY --from=build --chown=node:node /out/telegram-bot ./
CMD ["node", "--enable-source-maps", "dist/index.js"]

FROM runtime AS vk-bot
COPY --from=build --chown=node:node /out/vk-bot ./
ENV PORT=3002
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3002/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/index.js"]
