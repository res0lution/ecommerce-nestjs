import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CatalogCacheService } from '@/modules/catalog/cache/catalog-cache.service';
import { ProductSearchIndexProducer } from '@/queues/product-search-index/product-search-index.producer';

import { ReviewsCacheService } from './cache/reviews-cache.service';
import type { ReviewEntity } from './entities';
import { ReviewsRepository } from './repository/reviews.repository';
import type {
  CreateReviewInput,
  ListProductReviewsInput,
  ProductReviewsListResult,
  UpdateReviewInput,
} from './reviews.types';

@Injectable()
export class ReviewsService {
  private readonly forbiddenWords = ['viagra', 'casino', 'scam'];

  constructor(
    private readonly repository: ReviewsRepository,
    private readonly cache: CatalogCacheService,
    private readonly reviewsCache: ReviewsCacheService,
    private readonly searchIndexProducer: ProductSearchIndexProducer,
  ) {}

  async listProductReviews(
    productId: string,
    input: ListProductReviewsInput,
  ): Promise<ProductReviewsListResult> {
    const productExists = await this.repository.existsProductById(productId);
    if (!productExists) {
      throw new NotFoundException('Product not found');
    }
    const cacheKey = this.reviewsCache.productReviewsListKey(productId, input);
    const cached = await this.reviewsCache.getReviewsList(cacheKey);
    if (cached) {
      return cached;
    }
    const reviews = await this.repository.listApprovedByProduct(productId, input);
    const response = {
      items: reviews.items,
      meta: {
        total: reviews.total,
        page: input.page,
      },
    };
    await this.reviewsCache.setReviewsList(cacheKey, response);
    return response;
  }

  async createReview(userId: string, dto: CreateReviewInput): Promise<ReviewEntity> {
    this.ensureNoForbiddenWords(dto);

    const product = await this.repository.findProductById(dto.productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const existing = await this.repository.findByProductAndUser(dto.productId, userId);
    if (existing) {
      throw new ConflictException('Review for this product already exists');
    }

    const created = await this.repository.createForUser(userId, {
      ...dto,
      title: this.normalizeNullable(dto.title),
      pros: this.normalizeNullable(dto.pros),
      cons: this.normalizeNullable(dto.cons),
    });
    await this.refreshProductReadModels(created.productId, product.slug, product.categorySlug);
    return created;
  }

  async updateReview(
    userId: string,
    reviewId: string,
    dto: UpdateReviewInput,
  ): Promise<ReviewEntity> {
    const existing = await this.repository.findByIdForUser(reviewId, userId);
    if (!existing) {
      throw new NotFoundException('Review not found');
    }
    this.ensureNoForbiddenWords(dto);

    const updated = await this.repository.updateById(reviewId, {
      ...dto,
      title: dto.title !== undefined ? this.normalizeNullable(dto.title) : undefined,
      pros: dto.pros !== undefined ? this.normalizeNullable(dto.pros) : undefined,
      cons: dto.cons !== undefined ? this.normalizeNullable(dto.cons) : undefined,
    });
    const product = await this.repository.findProductById(updated.productId);
    await this.refreshProductReadModels(updated.productId, product?.slug, product?.categorySlug);
    return updated;
  }

  async deleteReview(userId: string, reviewId: string): Promise<void> {
    const existing = await this.repository.findByIdForUser(reviewId, userId);
    if (!existing) {
      throw new NotFoundException('Review not found');
    }
    await this.repository.deleteById(reviewId);
    const product = await this.repository.findProductById(existing.productId);
    await this.refreshProductReadModels(existing.productId, product?.slug, product?.categorySlug);
  }

  private async refreshProductReadModels(
    productId: string,
    productSlug?: string,
    categorySlug?: string,
  ): Promise<void> {
    await this.repository.recalculateProductRating(productId);
    await this.reviewsCache.invalidateProduct(productId);
    if (productSlug !== undefined) {
      await this.cache.invalidateProduct(productSlug, categorySlug);
    }
    await this.searchIndexProducer.enqueueProductReindex(productId);
  }

  private ensureNoForbiddenWords(input: {
    title?: string;
    content?: string;
    pros?: string;
    cons?: string;
  }): void {
    const chunks = [input.title, input.content, input.pros, input.cons]
      .filter((value): value is string => value !== undefined)
      .map((value) => value.toLowerCase());

    const found = this.forbiddenWords.find((word) => chunks.some((chunk) => chunk.includes(word)));
    if (found != null) {
      throw new BadRequestException(`Content contains forbidden word: ${found}`);
    }
  }

  private normalizeNullable(value: string | undefined): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    const normalized = value.trim();
    if (normalized.length === 0) {
      return '';
    }
    return normalized;
  }
}
