# syntax=docker/dockerfile:1.7
# ARM64 / x86_64 両対応。node:26-slim は linux/arm64・linux/amd64 multi-arch。
ARG NODE_VERSION=26

# ---------- base ----------
FROM node:${NODE_VERSION}-slim AS base
# Node 25+ は corepack を同梱しないため npm で pnpm を導入（packageManager と版を揃える）。
# store-dir をキャッシュマウント先に固定して install を高速化。
RUN npm install -g pnpm@10.33.0 && pnpm config set store-dir /pnpm/store
WORKDIR /app

# ---------- build（全体をビルドし、bot/web を prod deploy で切り出す）----------
FROM base AS build
# Prisma engine が必要とする openssl
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install -r --frozen-lockfile
RUN pnpm --filter @gatekeeper/core prisma:generate
RUN pnpm -r build
RUN pnpm --filter @gatekeeper/web --prod deploy /prod-web
RUN pnpm --filter @gatekeeper/bot --prod deploy /prod-bot

# ---------- web ----------
FROM node:${NODE_VERSION}-slim AS web
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /prod-web /app
USER node
CMD ["node", "dist/server.js"]

# ---------- bot ----------
FROM node:${NODE_VERSION}-slim AS bot
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /prod-bot /app
USER node
CMD ["node", "dist/index.js"]

# ---------- migrate（prisma CLI + schema + migrations を持つ一時ジョブ用）----------
FROM build AS migrate
WORKDIR /app/packages/core
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]
