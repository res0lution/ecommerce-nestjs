# Database Seeding

## Command

```bash
npm run prisma:seed
```

Entry point:

- `prisma/seed.ts`

Seed modules:

- `prisma/seeds/catalog.seed.ts`
- `prisma/seeds/users.seed.ts`
- `prisma/seeds/reviews.seed.ts`
- `prisma/seeds/commerce.seed.ts`

## Seed order

1. Catalog graph (categories, attributes, products, variants, images, product-attribute links)
2. Users, user settings, addresses
3. Reviews and product rating aggregates
4. Commerce graph (cart, cart items, orders, order items, payments, webhook events)

## Idempotency strategy

- Models with unique keys use `upsert` (`slug`, `email`, `sku`, `order number`, `eventId`, etc.).
- Collections without stable unique natural keys are normalized by `deleteMany` + `createMany` for seeded scope (for example images/order items per seeded parent).
- Re-running seed updates deterministic records instead of duplicating them.

## Seeded accounts

- `admin@seed.local`
- `buyer@seed.local`
- `reviewer@seed.local`
- `guest@seed.local`

The default password is printed in command output.

## Extending seeds

When adding new seeded records:

1) Reuse stable keys (`slug`, `sku`, `email`, `number`) and keep values deterministic.
2) Place data in the relevant domain seed file.
3) Keep dependency order intact.
4) For new relations, update the upstream seed first (for example create product before new variant seed).
