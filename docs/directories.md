# Project Directories

Actual repository structure (high-level):

```text
.
├── docker/
│   └── docker-compose.yml
├── docs/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   ├── seed.ts
│   └── seeds/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── worker.ts
│   ├── worker.module.ts
│   ├── common/
│   ├── config/
│   ├── database/
│   ├── modules/
│   │   ├── address/
│   │   ├── auth/
│   │   ├── cart/
│   │   ├── catalog/
│   │   ├── notifications/
│   │   ├── orders/
│   │   ├── payments/
│   │   ├── profile/
│   │   ├── reviews/
│   │   └── settings/
│   ├── queues/
│   │   ├── auth-email/
│   │   ├── product-search-index/
│   │   └── processors/
│   └── tests/
├── .env.example
├── package.json
└── README.md
```

## Notes

- Prisma lives in top-level `prisma/`, not under `src/`.
- Workers are a separate Nest application context (`worker.ts`).
- Queue producers/processors are centralized under `src/queues/`.
- Domain modules are grouped under `src/modules/` and imported in `src/app.module.ts`.