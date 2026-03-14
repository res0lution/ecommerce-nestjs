🧱 1. Конфигурационный слой

Используется модуль конфигурации.

Обычно через:

@nestjs/config

Структура:

config
 ├ configuration.ts
 ├ env.validation.ts
 └ index.ts

env.validation.ts проверяет переменные среды через:

Zod

Это защищает от ошибок в продакшене.

🧾 2. Логирование

Production backend должен иметь нормальные логи.

Обычно используют:

Pino

nestjs-pino

Что логируют:

request
response
errors
jobs
payments
🛡 3. Глобальная обработка ошибок

Нужен Exception Filter.

common
 └ filters
     └ http-exception.filter.ts

Он делает:

try
catch
logging
error response
🔐 4. Security

Минимум:

Helmet (HTTP security headers)

Passport.js (auth)

jsonwebtoken (JWT)

Также:

rate limiting
csrf
cors

rate limiting через:

@nestjs/throttler

⚡ 5. Кеширование

Для API caching используют:

Redis

Через:

cache-manager

Примеры кеша:

products:list
products:detail
categories:list
📦 6. Очереди задач

Через:

BullMQ

Очереди используются для:

email sending
order processing
stock updates
analytics
search indexing
🔎 7. Поиск

Если товаров больше 5–10k, нужен поиск.

Через:

Elasticsearch

Он делает:

autocomplete
filters
ranking
fast search
🧪 8. Тестирование

Нужно два типа тестов.

unit tests

через:

Jest

e2e tests

Nest имеет встроенный e2e setup.

📜 9. Документация API

Для REST API почти всегда используют:

Swagger

Через:

@nestjs/swagger

Это автоматически генерирует API docs.

📡 10. Валидация DTO

Используют:

class-validator

class-transformer

Пример:

@IsEmail()
email: string
🧩 11. Middleware

Полезные middleware:

request-id
logging
metrics

request id нужен для tracing.

📊 12. Monitoring

Production сервисы должны мониториться.

Обычно:

Prometheus

Grafana

Метрики:

latency
errors
queue size
db queries
📦 13. CI/CD

Автоматическая сборка.

Обычно через:

GitHub Actions

Pipeline:

lint
test
build
docker build
deploy
🐳 14. Docker

Контейнеризация через:

Docker

Compose обычно поднимает:

PostgreSQL
Redis
Elasticsearch

1️⃣ Idempotency для платежей

Очень частая проблема.

Пользователь может:

нажать кнопку оплаты 2 раза

обновить страницу

платежный сервис может прислать webhook дважды

Без idempotency получится:

2 платежа
2 заказа

Решение:

таблица

payment_idempotency
key	status
payment-uuid	completed

И API:

POST /payments
Idempotency-Key: uuid
2️⃣ Race condition при покупке

Классическая проблема.

Пример:

Stock = 1

Два пользователя покупают одновременно.

Без защиты:

stock = -1

Решение:

transaction + row lock

В PostgreSQL:

SELECT * FROM inventory
WHERE variant_id = ?
FOR UPDATE
3️⃣ Reserved stock (резерв склада)

Нельзя просто уменьшать quantity.

Правильная модель:

quantity = 10
reserved = 3
available = 7

При checkout:

reserved +1

После оплаты:

quantity -1
reserved -1
4️⃣ Soft delete

Удалять товары из базы нельзя.

Иначе:

сломаются старые заказы

Правильный подход:

deleted_at timestamp

или

status = ARCHIVED
5️⃣ Snapshot данных в заказе

Товар может измениться после покупки.

Например:

Nike Air Max
price = 120

Через месяц:

price = 150

Но заказ должен сохранить старую цену.

Поэтому в order_items:

product_title
sku
price

Это snapshot данных.

6️⃣ Cart expiration

Корзины нельзя хранить бесконечно.

Нужно:

expire cart after 30 days

или очищать через очередь BullMQ.

7️⃣ Webhook retry logic

Платежные сервисы могут прислать webhook несколько раз.

Нужно:

idempotent webhook handler

и таблица:

processed_webhooks
8️⃣ Product search indexing

После изменения товара нужно обновлять поиск.

Если используется Elasticsearch:

нельзя делать indexing в HTTP request.

Лучше:

product updated
   ↓
queue job
   ↓
index product

через BullMQ.

9️⃣ Pagination (очень важно)

Никогда нельзя делать:

GET /products

без pagination.

Правильно:

GET /products?limit=20&cursor=abc

cursor pagination намного быстрее offset.

🔟 Audit logging

Очень важно для админки.

Нужно знать:

кто изменил цену
кто удалил товар
кто поменял склад

таблица:

audit_logs

| user | action | entity | timestamp |

🚨 Бонус: большая проблема ecommerce
Inventory locking

Если не реализовать правильно:

overselling

Например:

Black Nike 42
stock = 1

20 человек пытаются купить.

Без locking:

20 orders