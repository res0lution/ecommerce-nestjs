# Environment Variables

Primary source files:

- `.env.example`
- `src/config/env.validation.ts`
- `src/config/configuration.ts`

## Runtime groups

## App and HTTP

- `NODE_ENV` - `development | production | test`
- `PORT` - API port
- `CORS_ORIGIN` - CORS origin

## Database

- `DATABASE_URL` - PostgreSQL DSN used by Prisma

## Redis and cache

- `REDIS_HOST`
- `REDIS_PORT`
- `CATALOG_CACHE_*`
- `COMMERCE_CACHE_*`

## Search

- `ELASTICSEARCH_ENABLED`
- `ELASTICSEARCH_NODE`
- `ELASTICSEARCH_USERNAME`
- `ELASTICSEARCH_PASSWORD`
- `ELASTICSEARCH_API_KEY`
- `ELASTICSEARCH_PRODUCTS_INDEX`

## Auth and sessions

- `JWT_ACCESS_SECRET` (min 16 chars)
- `JWT_REFRESH_SECRET` (min 16 chars)
- `JWT_ACCESS_EXPIRES`
- `JWT_REFRESH_EXPIRES`
- `AUTH_REFRESH_COOKIE_NAME`

## OAuth

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `YANDEX_CLIENT_ID`
- `YANDEX_CLIENT_SECRET`
- `YANDEX_CALLBACK_URL`

## URLs

- `FRONTEND_URL`
- `APP_URL`

## Email

- `RESEND_API_KEY`
- `RESEND_FROM`

## Checkout and payments

- `CHECKOUT_CURRENCY` (currently `RUB`)
- `CHECKOUT_DELIVERY_FIXED_AMOUNT`
- `YOOKASSA_SHOP_ID`
- `YOOKASSA_SECRET_KEY`
- `YOOKASSA_RETURN_URL`
- `YOOKASSA_WEBHOOK_SECRET`

## Docker-related convenience variables

Used by `docker/docker-compose.yml`:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `POSTGRES_PORT`
- `REDIS_PORT`
- `ELASTICSEARCH_PORT`
- `ELASTIC_PASSWORD`

## Local baseline

For most local setups:

- keep `.env.example` defaults,
- run PostgreSQL and Redis via compose,
- set `ELASTICSEARCH_ENABLED=false` if ES service is not started.
