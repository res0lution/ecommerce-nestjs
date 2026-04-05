import { PrismaClient } from '@prisma/client';

import { seedCatalog } from './seeds/catalog.seed';
import { seedCommerce } from './seeds/commerce.seed';
import { seedReviews } from './seeds/reviews.seed';
import { seedUsers } from './seeds/users.seed';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding catalog...');
  const catalog = await seedCatalog(prisma);

  console.log('Seeding users, settings and addresses...');
  const users = await seedUsers(prisma);

  console.log('Seeding reviews and product rating aggregates...');
  await seedReviews(prisma, catalog, users);

  console.log('Seeding cart, orders, payments and webhook events...');
  await seedCommerce(prisma, catalog, users);

  console.log('Seed completed successfully.');
  console.log(`Seed users password: ${users.defaultPassword}`);
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
