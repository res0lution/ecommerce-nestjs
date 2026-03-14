📁 Production структура папок NestJS ecommerce
src
 ├── main.ts
 ├── app.module.ts

 ├── config/
 │   ├── configuration.ts
 │   ├── env.validation.ts
 │   └── index.ts

 ├── database/
 │   ├── prisma.service.ts
 │   ├── prisma.module.ts
 │   └── migrations/

 ├── common/
 │   ├── decorators/
 │   ├── filters/
 │   ├── guards/
 │   ├── interceptors/
 │   ├── pipes/
 │   └── utils/

 ├── modules/
 │
 │   ├── auth/
 │   │   ├── auth.controller.ts
 │   │   ├── auth.service.ts
 │   │   ├── auth.module.ts
 │   │   ├── strategies/
 │   │   │   ├── jwt.strategy.ts
 │   │   │   └── google.strategy.ts
 │   │   └── dto/
 │   │
 │   ├── users/
 │   │   ├── users.controller.ts
 │   │   ├── users.service.ts
 │   │   ├── users.module.ts
 │   │   ├── repository/
 │   │   └── dto/
 │   │
 │   ├── products/
 │   │   ├── products.controller.ts
 │   │   ├── products.service.ts
 │   │   ├── products.module.ts
 │   │   ├── dto/
 │   │   ├── entities/
 │   │   └── repository/
 │   │
 │   ├── categories/
 │   │   ├── categories.controller.ts
 │   │   ├── categories.service.ts
 │   │   ├── categories.module.ts
 │   │
 │   ├── cart/
 │   │   ├── cart.controller.ts
 │   │   ├── cart.service.ts
 │   │   ├── cart.module.ts
 │   │
 │   ├── orders/
 │   │   ├── orders.controller.ts
 │   │   ├── orders.service.ts
 │   │   ├── orders.module.ts
 │   │
 │   ├── payments/
 │   │   ├── payments.service.ts
 │   │   ├── payments.module.ts
 │   │
 │   ├── search/
 │   │   ├── search.service.ts
 │   │   ├── elasticsearch.service.ts
 │   │   └── search.module.ts
 │   │
 │   ├── notifications/
 │   │   ├── email.service.ts
 │   │   ├── notifications.module.ts
 │   │
 │   └── admin/
 │       ├── admin.controller.ts
 │       └── admin.module.ts

 ├── queues/
 │   ├── bull.config.ts
 │   ├── processors/
 │   │   ├── email.processor.ts
 │   │   ├── order.processor.ts
 │   │   └── stock.processor.ts
 │   └── producers/

 ├── cache/
 │   ├── redis.module.ts
 │   └── redis.service.ts

 ├── search/
 │   └── elasticsearch.module.ts

 ├── prisma/
 │   ├── schema.prisma
 │   └── seed.ts

 └── tests/
📦 Главные модули e-commerce

В ecommerce обычно есть такие домены:

Модуль	Что делает
auth	login / registration
users	профиль пользователя
products	товары
categories	категории
cart	корзина
orders	заказы
payments	платежи
search	поиск
notifications	email
admin	админка
🧠 Как выглядит модуль (пример products)
products
 ├── products.controller.ts
 ├── products.service.ts
 ├── products.module.ts
 ├── dto/
 │   ├── create-product.dto.ts
 │   └── update-product.dto.ts
 ├── entities/
 │   └── product.entity.ts
 └── repository/
     └── products.repository.ts
⚡ Где используется Redis

Через Redis:

cache
 ├── redis.module.ts
 └── redis.service.ts

Примеры:

products:list
product:{id}
cart:{userId}
📦 Очереди через BullMQ

Через BullMQ:

queues
 ├── producers
 │   └── email.producer.ts
 └── processors
     └── email.processor.ts

Пример:

Order created
 → send email
 → update stock
 → analytics event
🔎 Поиск через Elasticsearch

Через Elasticsearch:

search
 ├── elasticsearch.module.ts
 └── search.service.ts

Используется для:

/products/search?q=nike
/products/filter?size=42
/products/filter?price=100-200
🧱 Prisma структура
prisma
 ├── schema.prisma
 └── seed.ts

ORM:

Prisma

📦 Docker
docker
 ├── Dockerfile
 └── docker-compose.yml

compose поднимает:

PostgreSQL
Redis
Elasticsearch