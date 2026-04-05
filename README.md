# E-commerce NestJS API

Production-oriented ecommerce backend on NestJS + Prisma + PostgreSQL with auth, catalog, reviews, cart, orders, payments and background workers.

## Core Modules

- `auth` - registration, login, OAuth, refresh sessions, email verification.
- `profile`, `address`, `settings` - user account data.
- `catalog` - categories, products, variants, filters, search indexing hooks.
- `reviews` - product reviews with aggregate rating updates.
- `cart` - cart items, totals and validation against stock.
- `orders` - checkout and order lifecycle.
- `payments` - YooKassa payment flow and webhooks.
- `queues` - BullMQ producers/processors (`auth-email`, `product-search-index`).

## Prerequisites

- Node.js `>=20`
- npm `>=10` (or pnpm/yarn if preferred)
- Docker + Docker Compose

## Quick Start

1) Install dependencies:

```bash
pnpm install
```

2) Prepare local env:

```bash
cp .env.example .env
```

3) Start infrastructure:

```bash
docker compose -f docker/docker-compose.yml --env-file .env up -d
```

4) Run Prisma migrations:

```bash
pnpm run prisma:migrate:dev
```

5) Fill database with demo data:

```bash
pnpm run prisma:seed
```

6) Start API:

```bash
pnpm run start:dev
```

7) (Optional) Start workers in a separate terminal:

```bash
pnpm run start:worker:dev
```

## API and Docs

- Swagger UI: `http://localhost:3000/api/docs`
- API prefix: `/api`

## Seed Data

`pnpm run prisma:seed` creates deterministic and idempotent demo data for:

- full catalog graph (categories, products, variants, images, attributes),
- users with settings and addresses,
- reviews and rating aggregates,
- cart items, orders, payments and payment webhook events.

Seeded local users:

- `admin@seed.local`
- `buyer@seed.local`
- `reviewer@seed.local`
- `guest@seed.local`

Default password is printed by the seed command output.

## Useful Commands

```bash
pnpm run start:dev
pnpm run start:worker:dev
pnpm run test
pnpm run test:e2e
pnpm run prisma:generate
pnpm run prisma:studio
```

## Local Infrastructure Notes

- `docker/docker-compose.yml` uses values from `.env` (`POSTGRES_*`, `POSTGRES_PORT`).
- Elasticsearch service is present but commented in compose; API can run with ES disabled by setting `ELASTICSEARCH_ENABLED=false`.

## Troubleshooting

- `Env validation failed`: check required vars in `.env.example` and `src/config/env.validation.ts`.
- Prisma connection errors: verify PostgreSQL container is up and `DATABASE_URL` is aligned with compose credentials.
- Redis/BullMQ errors: ensure Redis container is running on `REDIS_HOST` / `REDIS_PORT`.
- Seed conflicts: seed is idempotent; if you changed unique fields manually, re-run seed or clean affected records.

## Project Documentation

- `docs/setup-local.md` - full local setup.
- `docs/env.md` - environment variables and defaults.
- `docs/seeding.md` - seed structure and extension guidelines.
- `docs/architecture.md` - module and data architecture.
- `docs/api.md` - API usage and key flows.
- `docs/operations.md` - workers, queues and operational guidance.
- `docs/directories.md` - actual repository structure.
- `docs/stack.md` - runtime stack used in this project.
