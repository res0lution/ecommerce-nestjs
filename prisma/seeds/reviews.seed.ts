import { PrismaClient, ReviewStatus } from '@prisma/client';

import type { CatalogSeedResult } from './catalog.seed';
import type { UsersSeedResult } from './users.seed';

interface ReviewSeed {
  productKey: string;
  userKey: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title?: string;
  content: string;
  pros?: string;
  cons?: string;
  isVerifiedPurchase: boolean;
  status: ReviewStatus;
}

const reviews: ReviewSeed[] = [
  {
    productKey: 'pegasus-41',
    userKey: 'buyer',
    rating: 5,
    title: 'Great daily trainer',
    content: 'Very comfortable pair for long runs and city use.',
    pros: 'Good cushioning, stable fit, durable outsole.',
    cons: 'Slightly warm in hot weather.',
    isVerifiedPurchase: true,
    status: ReviewStatus.APPROVED,
  },
  {
    productKey: 'pegasus-41',
    userKey: 'reviewer',
    rating: 4,
    content: 'Reliable for everyday training and easy recovery sessions.',
    isVerifiedPurchase: false,
    status: ReviewStatus.APPROVED,
  },
  {
    productKey: 'infinity-run-4-w',
    userKey: 'reviewer',
    rating: 5,
    content: 'Great support during long distance efforts.',
    isVerifiedPurchase: false,
    status: ReviewStatus.PENDING,
  },
  {
    productKey: 'metcon-9',
    userKey: 'buyer',
    rating: 3,
    content: 'Good stability for gym work, but not ideal for long runs.',
    isVerifiedPurchase: true,
    status: ReviewStatus.APPROVED,
  },
];

export async function seedReviews(
  prisma: PrismaClient,
  catalog: CatalogSeedResult,
  users: UsersSeedResult,
): Promise<void> {
  for (const review of reviews) {
    await prisma.review.upsert({
      where: {
        productId_userId: {
          productId: catalog.productIds[review.productKey],
          userId: users.userIds[review.userKey],
        },
      },
      update: {
        rating: review.rating,
        title: review.title ?? null,
        content: review.content,
        pros: review.pros ?? null,
        cons: review.cons ?? null,
        isVerifiedPurchase: review.isVerifiedPurchase,
        status: review.status,
      },
      create: {
        productId: catalog.productIds[review.productKey],
        userId: users.userIds[review.userKey],
        rating: review.rating,
        title: review.title ?? null,
        content: review.content,
        pros: review.pros ?? null,
        cons: review.cons ?? null,
        isVerifiedPurchase: review.isVerifiedPurchase,
        status: review.status,
      },
    });
  }

  const affectedProducts = Array.from(new Set(reviews.map((review) => review.productKey)));
  for (const productKey of affectedProducts) {
    const productId = catalog.productIds[productKey];
    const grouped = await prisma.review.groupBy({
      by: ['rating'],
      where: { productId, status: ReviewStatus.APPROVED },
      _count: { _all: true },
    });

    let totalReviews = 0;
    let weightedSum = 0;
    const counters = {
      rating1: 0,
      rating2: 0,
      rating3: 0,
      rating4: 0,
      rating5: 0,
    };

    for (const row of grouped) {
      const count = row._count._all;
      totalReviews += count;
      weightedSum += row.rating * count;
      if (row.rating >= 1 && row.rating <= 5) {
        counters[`rating${row.rating}` as keyof typeof counters] = count;
      }
    }

    const avg = totalReviews > 0 ? Number((weightedSum / totalReviews).toFixed(2)) : 0;
    await prisma.product.update({
      where: { id: productId },
      data: {
        ratingAvg: avg,
        reviewsCount: totalReviews,
        ...counters,
      },
    });
  }
}
