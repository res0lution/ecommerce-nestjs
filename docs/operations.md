# Operations

## Runtime processes

- API process: `npm run start:dev` (or `start:prod`)
- Worker process: `npm run start:worker:dev` (or `start:worker:prod`)

Run workers separately from API in production and staging.

## Queue processing

Configured through BullMQ with Redis backend:

- queue bootstrap: `src/queues/bull.config.ts`
- auth-email queue: `src/queues/auth-email/*`
- product-search-index queue: `src/queues/product-search-index/*`

## Payments and webhooks

- Provider: YooKassa
- Webhook endpoint: `/api/payments/webhooks/yookassa`
- Signature secret: `YOOKASSA_WEBHOOK_SECRET`
- Processed events are persisted in `payment_webhook_events` for idempotency.

## Data lifecycle cautions

- `order_items` reference product and variant with `onDelete: Restrict`.
- If cleanup is needed, remove dependent payment/order records first.
- Seed script is idempotent, but manual destructive SQL can break assumptions.

## Deployment checklist (minimal)

1) Start PostgreSQL and Redis.
2) Apply Prisma migrations.
3) Run seed only for non-production environments unless intentional.
4) Start API and worker processes.
5) Verify `/api/docs` and queue consumers are healthy.

## Troubleshooting

- Queue jobs not processed: confirm worker process is running and connected to same Redis.
- Webhook rejected: validate `x-yookassa-signature` and `YOOKASSA_WEBHOOK_SECRET`.
- High error rate: check env validation output, DB connectivity and Redis health first.
