# Stack

## Language and framework

- TypeScript
- NestJS 11

## Data layer

- PostgreSQL
- Prisma ORM

## Caching and infra services

- Redis (cache + throttling storage + BullMQ backend)
- BullMQ for async jobs
- Optional Elasticsearch integration for catalog indexing/search

## Auth and security

- JWT access/refresh tokens
- Passport strategies (local/JWT/OAuth)
- Helmet, validation pipes and request throttling

## API and docs

- REST API
- Swagger (`/api/docs`)

## Runtime topology

- API process (`src/main.ts`)
- Worker process (`src/worker.ts`) for queue consumers
- Docker Compose for local PostgreSQL and Redis