import { Injectable } from '@nestjs/common';
import { Prisma, ReviewStatus } from '@prisma/client';

import { PrismaService } from '@/database/prisma.service';

import type {
  CreateReviewInput,
  ListProductReviewsInput,
  ReviewResult,
  UpdateReviewInput,
} from '../reviews.types';

@Injectable()
export class ReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async existsProductById(productId: string): Promise<boolean> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    return product !== null;
  }

  async findProductById(
    productId: string,
  ): Promise<{ id: string; slug: string; categorySlug: string } | null> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        slug: true,
        category: {
          select: {
            slug: true,
          },
        },
      },
    });
    if (!product) {
      return null;
    }
    return {
      id: product.id,
      slug: product.slug,
      categorySlug: product.category.slug,
    };
  }

  async findByIdForUser(
    reviewId: string,
    userId: string,
  ): Promise<Pick<ReviewResult, 'id' | 'productId'> | null> {
    return this.prisma.review.findFirst({
      where: { id: reviewId, userId },
      select: {
        id: true,
        productId: true,
      },
    });
  }

  async findByProductAndUser(productId: string, userId: string): Promise<ReviewResult | null> {
    return this.prisma.review.findUnique({
      where: {
        productId_userId: {
          productId,
          userId,
        },
      },
    });
  }

  async createForUser(userId: string, dto: CreateReviewInput): Promise<ReviewResult> {
    return this.prisma.review.create({
      data: {
        userId,
        productId: dto.productId,
        rating: dto.rating,
        title: dto.title ?? null,
        content: dto.content,
        pros: dto.pros ?? null,
        cons: dto.cons ?? null,
        status: ReviewStatus.APPROVED,
      },
    });
  }

  async updateById(reviewId: string, dto: UpdateReviewInput): Promise<ReviewResult> {
    const data: Prisma.ReviewUpdateInput = {
      ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.content !== undefined ? { content: dto.content } : {}),
      ...(dto.pros !== undefined ? { pros: dto.pros } : {}),
      ...(dto.cons !== undefined ? { cons: dto.cons } : {}),
    };
    return this.prisma.review.update({
      where: { id: reviewId },
      data,
    });
  }

  async deleteById(reviewId: string): Promise<void> {
    await this.prisma.review.delete({
      where: { id: reviewId },
    });
  }

  async listApprovedByProduct(
    productId: string,
    input: ListProductReviewsInput,
  ): Promise<{ items: ReviewResult[]; total: number }> {
    const where: Prisma.ReviewWhereInput = {
      productId,
      status: ReviewStatus.APPROVED,
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
    };
    const skip = (input.page - 1) * input.limit;
    const orderBy: Prisma.ReviewOrderByWithRelationInput[] =
      input.sort === 'rating'
        ? [{ rating: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
        : [{ createdAt: 'desc' }, { id: 'desc' }];

    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy,
        skip,
        take: input.limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return { items, total };
  }

  async recalculateProductRating(productId: string): Promise<void> {
    const grouped = await this.prisma.review.groupBy({
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
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        ratingAvg: avg,
        reviewsCount: totalReviews,
        ...counters,
      },
    });
  }
}
