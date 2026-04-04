import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Queue } from 'bullmq';

import { PrismaService } from '@/database/prisma.service';
import { AUTH_EMAIL_QUEUE, PRODUCT_SEARCH_INDEX_QUEUE } from '@/queues/queue.constants';

async function closeQueue(app: INestApplication, queueName: string): Promise<void> {
  const token = getQueueToken(queueName);
  let queue: Queue | null = null;
  try {
    queue = app.get<Queue>(token, { strict: false });
  } catch {
    queue = null;
  }

  if (!queue) {
    return;
  }

  await queue.close();
}

export async function teardownE2eApp(
  app: INestApplication,
  prisma: PrismaService | undefined,
): Promise<void> {
  await closeQueue(app, AUTH_EMAIL_QUEUE);
  await closeQueue(app, PRODUCT_SEARCH_INDEX_QUEUE);

  if (prisma) {
    await prisma.$disconnect();
  }

  await app.close();
}
