import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ReviewStatus } from '@prisma/client';

import { CatalogCacheService } from '@/modules/catalog/cache/catalog-cache.service';
import { ProductSearchIndexProducer } from '@/queues/product-search-index/product-search-index.producer';

import { ReviewsCacheService } from './cache/reviews-cache.service';
import { ReviewsRepository } from './repository/reviews.repository';
import { ReviewsService } from './reviews.service';

type ReviewsRepositoryMock = Pick<
  ReviewsRepository,
  | 'createForUser'
  | 'deleteById'
  | 'existsProductById'
  | 'findByIdForUser'
  | 'findByProductAndUser'
  | 'findProductById'
  | 'listApprovedByProduct'
  | 'recalculateProductRating'
  | 'updateById'
>;
type CatalogCacheMock = Pick<CatalogCacheService, 'invalidateProduct'>;
type ReviewsCacheMock = Pick<
  ReviewsCacheService,
  'getReviewsList' | 'invalidateProduct' | 'productReviewsListKey' | 'setReviewsList'
>;
type ProducerMock = Pick<ProductSearchIndexProducer, 'enqueueProductReindex'>;

describe('ReviewsService', () => {
  let service: ReviewsService;
  let repository: jest.Mocked<ReviewsRepositoryMock>;
  let cache: jest.Mocked<CatalogCacheMock>;
  let reviewsCache: jest.Mocked<ReviewsCacheMock>;
  let producer: jest.Mocked<ProducerMock>;

  beforeEach(() => {
    repository = {
      createForUser: jest.fn(),
      deleteById: jest.fn(),
      existsProductById: jest.fn(),
      findByIdForUser: jest.fn(),
      findByProductAndUser: jest.fn(),
      findProductById: jest.fn(),
      listApprovedByProduct: jest.fn(),
      recalculateProductRating: jest.fn(),
      updateById: jest.fn(),
    };
    cache = {
      invalidateProduct: jest.fn(),
    };
    reviewsCache = {
      getReviewsList: jest.fn(),
      invalidateProduct: jest.fn(),
      productReviewsListKey: jest.fn(),
      setReviewsList: jest.fn(),
    };
    producer = {
      enqueueProductReindex: jest.fn(),
    };

    service = new ReviewsService(
      repository as unknown as ReviewsRepository,
      cache as unknown as CatalogCacheService,
      reviewsCache as unknown as ReviewsCacheService,
      producer as unknown as ProductSearchIndexProducer,
    );
  });

  it('createReview rejects duplicate review per product and user', async () => {
    repository.findProductById.mockResolvedValue({
      id: 'p1',
      slug: 'runner',
      categorySlug: 'men',
    });
    repository.findByProductAndUser.mockResolvedValue({
      id: 'r-existing',
    } as never);

    await expect(
      service.createReview('u1', {
        productId: 'p1',
        rating: 5,
        content: 'Great shoes for daily runs and long sessions',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('createReview updates aggregates and invalidates caches', async () => {
    repository.findProductById.mockResolvedValue({
      id: 'p1',
      slug: 'runner',
      categorySlug: 'men',
    });
    repository.findByProductAndUser.mockResolvedValue(null);
    repository.createForUser.mockResolvedValue({
      id: 'r1',
      productId: 'p1',
      userId: 'u1',
      rating: 5,
      title: null,
      content: 'Great shoes for daily runs and long sessions',
      pros: null,
      cons: null,
      isVerifiedPurchase: false,
      status: ReviewStatus.APPROVED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createReview('u1', {
      productId: 'p1',
      rating: 5,
      content: 'Great shoes for daily runs and long sessions',
    });

    expect(result.id).toBe('r1');
    expect(repository.recalculateProductRating).toHaveBeenCalledWith('p1');
    expect(reviewsCache.invalidateProduct).toHaveBeenCalledWith('p1');
    expect(cache.invalidateProduct).toHaveBeenCalledWith('runner', 'men');
    expect(producer.enqueueProductReindex).toHaveBeenCalledWith('p1');
  });

  it('updateReview rejects missing own review', async () => {
    repository.findByIdForUser.mockResolvedValue(null);

    await expect(
      service.updateReview('u1', 'r1', {
        content: 'Updated review text with enough symbols',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listProductReviews returns cache hit without repository call', async () => {
    repository.existsProductById.mockResolvedValue(true);
    reviewsCache.productReviewsListKey.mockReturnValue('reviews:v1:list:p1:key');
    reviewsCache.getReviewsList.mockResolvedValue({
      items: [],
      meta: {
        total: 0,
        page: 1,
      },
    });

    const result = await service.listProductReviews('p1', {
      page: 1,
      limit: 10,
      sort: 'latest',
    });

    expect(result.meta.total).toBe(0);
    expect(repository.listApprovedByProduct).not.toHaveBeenCalled();
  });

  it('listProductReviews stores result to cache on cache miss', async () => {
    repository.existsProductById.mockResolvedValue(true);
    reviewsCache.productReviewsListKey.mockReturnValue('reviews:v1:list:p1:key');
    reviewsCache.getReviewsList.mockResolvedValue(undefined);
    repository.listApprovedByProduct.mockResolvedValue({
      items: [
        {
          id: 'r1',
          productId: 'p1',
          userId: 'u1',
          rating: 4,
          title: null,
          content: 'Solid pair for everyday city runs and easy workouts',
          pros: null,
          cons: null,
          isVerifiedPurchase: false,
          status: ReviewStatus.APPROVED,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      total: 1,
    });

    const result = await service.listProductReviews('p1', {
      page: 2,
      limit: 5,
      sort: 'rating',
      rating: 4,
    });

    expect(repository.listApprovedByProduct).toHaveBeenCalledWith('p1', {
      page: 2,
      limit: 5,
      sort: 'rating',
      rating: 4,
    });
    expect(reviewsCache.setReviewsList).toHaveBeenCalledWith('reviews:v1:list:p1:key', result);
  });

  it('createReview rejects forbidden words in content', async () => {
    await expect(
      service.createReview('u1', {
        productId: 'p1',
        rating: 5,
        content: 'This is scam offer text that should fail validation.',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createReview normalizes optional fields before persisting', async () => {
    repository.findProductById.mockResolvedValue({
      id: 'p1',
      slug: 'runner',
      categorySlug: 'men',
    });
    repository.findByProductAndUser.mockResolvedValue(null);
    repository.createForUser.mockResolvedValue({
      id: 'r1',
      productId: 'p1',
      userId: 'u1',
      rating: 5,
      title: '',
      content: 'Great shoes for daily runs and long sessions',
      pros: '',
      cons: '',
      isVerifiedPurchase: false,
      status: ReviewStatus.APPROVED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.createReview('u1', {
      productId: 'p1',
      rating: 5,
      title: '   ',
      content: 'Great shoes for daily runs and long sessions',
      pros: '   ',
      cons: '   ',
    });

    expect(repository.createForUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        title: '',
        pros: '',
        cons: '',
      }),
    );
  });

  it('updateReview rejects forbidden words in updated fields', async () => {
    repository.findByIdForUser.mockResolvedValue({
      id: 'r1',
      productId: 'p1',
    });

    await expect(
      service.updateReview('u1', 'r1', {
        content: 'Contains casino spam content and should be rejected',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
