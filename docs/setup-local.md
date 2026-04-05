# Local Setup

## Prerequisites

- Node.js `>=20`
- npm `>=10`
- Docker + Docker Compose

## 1) Install dependencies

```bash
npm install
```

## 2) Configure environment

Create a local file from template:

```bash
cp .env.example .env
```

Minimal required variables to boot API:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

Most values in `.env.example` are already ready for local development.

## 3) Start infrastructure

```bash
docker compose -f docker/docker-compose.yml --env-file .env up -d
```

By default this starts:

- PostgreSQL (`POSTGRES_PORT`, defaults to `5432`)
- Redis (`REDIS_PORT`, defaults to `6379`)

Elasticsearch service is intentionally commented out in compose. You can run without it by setting:

```env
ELASTICSEARCH_ENABLED=false
```

## 4) Prepare database

```bash
npm run prisma:migrate:dev
npm run prisma:seed
```

The seed command is idempotent and can be re-run safely.

## 5) Run API

```bash
npm run start:dev
```

Available after startup:

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`

## 6) Run workers (optional but recommended)

In another terminal:

```bash
npm run start:worker:dev
```

Workers process:

- auth email jobs
- product search index jobs

## 7) Run tests

```bash
npm run test
npm run test:e2e
```
