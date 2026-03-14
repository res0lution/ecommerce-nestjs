Monolith Rest Api

Backend
NestJS
TypeScript

Database
PostgreSQL
Prisma

Cache
Redis

Queue
BullMQ

Search
Elasticsearch

Auth
JWT + Passport

Infra
Docker
GitHub Actions

🚀 Рекомендуемый стек для backend e-commerce (JS/TS)
1. Основной фреймворк

NestJS

🗄 База данных

PostgreSQL

ORM

Prisma

⚡ Кэш

Redis

Используется для:

кеширования товаров

корзины

сессий

rate limiting

🔐 Аутентификация

JWT

Passport.js

Поддерживает:

OAuth

Google login

email/password

📦 Очереди задач

Для e-commerce это обязательно.

Например:

отправка email

обработка платежей

обновление stock

Используют:

BullMQ


🔎 Поиск товаров

Если товаров много:

Elasticsearch

Позволяет:

быстрый поиск

фильтры

автокомплит

📡 API

REST

☁️ Инфраструктура
Контейнеризация

Docker

CI/CD

GitHub Actions