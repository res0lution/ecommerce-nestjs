import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductGender } from '@prisma/client';

import { ProductSearchIndexProducer } from '@/queues/product-search-index/product-search-index.producer';

import { CatalogCacheService } from './cache/catalog-cache.service';
import { CatalogService } from './catalog.service';
import { CatalogRepository } from './repository/catalog.repository';
import { CatalogSearchService } from './search/catalog-search.service';

type CatalogRepositoryMock = Pick<
  CatalogRepository,
  | 'findProductBySlug'
  | 'findRecommendations'
  | 'findSizeAvailabilityByProductSlug'
  | 'getFilterFacets'
  | 'listCategories'
  | 'listProductsPage'
>;
type CatalogSearchServiceMock = Pick<CatalogSearchService, 'getFilters' | 'searchProducts'>;
type ProductSearchIndexProducerMock = Pick<ProductSearchIndexProducer, 'enqueueProductReindex'>;

describe('CatalogService', () => {
  let service: CatalogService;
  let cache: CatalogCacheService;
  let repository: jest.Mocked<CatalogRepositoryMock>;
  let searchService: jest.Mocked<CatalogSearchServiceMock>;
  let searchIndexProducer: jest.Mocked<ProductSearchIndexProducerMock>;

  beforeEach(() => {
    cache = new CatalogCacheService({
      get<T>(key: string, defaultValue?: T): T {
        const values: Record<string, unknown> = {
          'catalogCache.enabled': true,
          'catalogCache.ttlSeconds.categories': 900,
          'catalogCache.ttlSeconds.filters': 600,
          'catalogCache.ttlSeconds.productsList': 60,
          'catalogCache.ttlSeconds.productDetails': 180,
          'redis.url': '',
        };
        const value = values[key];
        return (value ?? defaultValue) as T;
      },
    } as ConfigService);
    repository = {
      findProductBySlug: jest.fn(),
      findRecommendations: jest.fn(),
      findSizeAvailabilityByProductSlug: jest.fn(),
      getFilterFacets: jest.fn(),
      listCategories: jest.fn(),
      listProductsPage: jest.fn(),
    };
    searchService = {
      getFilters: jest.fn(),
      searchProducts: jest.fn(),
    };
    searchIndexProducer = {
      enqueueProductReindex: jest.fn(),
    };

    service = new CatalogService(
      cache,
      repository as unknown as CatalogRepository,
      searchService as unknown as CatalogSearchService,
      searchIndexProducer as unknown as ProductSearchIndexProducer,
    );
  });

  it('listProducts applies fallback sorting and maps SKU-derived fields', async () => {
    searchService.searchProducts.mockResolvedValue(null);
    repository.listCategories.mockResolvedValue([]);
    repository.listProductsPage.mockResolvedValue({
      total: 1,
      items: [
        {
          id: 'p1',
          title: 'Runner',
          slug: 'runner',
          description: 'desc',
          categoryId: 'c1',
          brand: 'Nike',
          gender: ProductGender.MEN,
          isActive: true,
          isBestSeller: true,
          popularityScore: 20,
          createdAt: new Date(),
          updatedAt: new Date(),
          category: {
            id: 'c1',
            name: 'Men',
            slug: 'men',
            parentId: null,
            level: 0,
            createdAt: new Date(),
          },
          variants: [
            {
              id: 'v1',
              productId: 'p1',
              sku: 'SKU-1',
              price: '150.00' as never,
              oldPrice: '200.00' as never,
              color: 'red',
              size: '42',
              stock: 3,
              isActive: true,
              images: [
                { id: 'i1', productId: 'p1', variantId: 'v1', url: 'http://img/1', sortOrder: 0 },
              ],
            },
            {
              id: 'v2',
              productId: 'p1',
              sku: 'SKU-2',
              price: '99.00' as never,
              oldPrice: null,
              color: 'blue',
              size: '43',
              stock: 5,
              isActive: true,
              images: [],
            },
          ],
          images: [],
          attributes: [],
          reviews: [],
        } as never,
      ],
    });

    const result = await service.listProducts({
      page: 1,
      limit: 20,
      sort: 'price_asc',
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual({
      id: 'p1',
      title: 'Runner',
      price: 99,
      image: 'http://img/1',
      badges: ['Best Seller', 'Discount'],
      colorsCount: 2,
    });
  });

  it('listProducts returns elastic result when search is available', async () => {
    const elasticResult = {
      total: 1,
      items: [
        {
          id: 'p-elastic',
          title: 'Elastic Product',
          price: 120,
          image: null,
          badges: [],
          colorsCount: 1,
        },
      ],
    };
    searchService.searchProducts.mockResolvedValue(elasticResult);
    repository.listCategories.mockResolvedValue([]);

    const result = await service.listProducts({
      page: 1,
      limit: 20,
      category: 'men',
    });

    expect(result).toEqual(elasticResult);
    expect(repository.listProductsPage).not.toHaveBeenCalled();
  });

  it('getCategoriesTree builds tree and then serves cached value', async () => {
    repository.listCategories.mockResolvedValue([
      {
        id: 'c1',
        name: 'Men',
        slug: 'men',
        parentId: null,
        level: 0,
        createdAt: new Date(),
      },
      {
        id: 'c2',
        name: 'Running',
        slug: 'running',
        parentId: 'c1',
        level: 1,
        createdAt: new Date(),
      },
    ] as never);

    const first = await service.getCategoriesTree();
    const second = await service.getCategoriesTree();

    expect(first).toEqual([
      {
        id: 'c1',
        name: 'Men',
        slug: 'men',
        children: [
          {
            id: 'c2',
            name: 'Running',
            slug: 'running',
            children: [],
          },
        ],
      },
    ]);
    expect(second).toEqual(first);
    expect(repository.listCategories).toHaveBeenCalledTimes(1);
  });

  it('getProductDetails returns variants, sizes availability and rating', async () => {
    repository.findProductBySlug.mockResolvedValue({
      id: 'p1',
      title: 'Runner',
      slug: 'runner',
      description: 'desc',
      categoryId: 'c1',
      brand: 'Nike',
      gender: ProductGender.MEN,
      isActive: true,
      isBestSeller: false,
      popularityScore: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: {
        id: 'c1',
        name: 'Men',
        slug: 'men',
        parentId: null,
        level: 0,
        createdAt: new Date(),
      },
      variants: [
        {
          id: 'v1',
          productId: 'p1',
          sku: 'SKU-1',
          price: '120.00' as never,
          oldPrice: null,
          color: 'red',
          size: '42',
          stock: 0,
          isActive: true,
          images: [
            { id: 'i1', productId: 'p1', variantId: 'v1', url: 'http://img/1', sortOrder: 0 },
          ],
        },
        {
          id: 'v2',
          productId: 'p1',
          sku: 'SKU-2',
          price: '110.00' as never,
          oldPrice: null,
          color: 'red',
          size: '42',
          stock: 3,
          isActive: true,
          images: [],
        },
      ],
      images: [
        { id: 'pimg1', productId: 'p1', variantId: null, url: 'http://img/main', sortOrder: 0 },
      ],
      attributes: [{ name: 'Gender', value: 'Men' }],
      reviews: [
        {
          id: 'r1',
          productId: 'p1',
          userId: 'u1',
          rating: 4,
          comment: 'good',
          createdAt: new Date(),
        },
        {
          id: 'r2',
          productId: 'p1',
          userId: 'u2',
          rating: 5,
          comment: 'great',
          createdAt: new Date(),
        },
      ],
    } as never);

    const result = await service.getProductDetails('runner');

    expect(result.price).toBe(110);
    expect(result.sizes).toEqual([{ size: '42', available: true }]);
    expect(result.rating).toBe(4.5);
    expect(result.reviewsCount).toBe(2);
  });

  it('getProductDetails throws for unknown slug', async () => {
    repository.findProductBySlug.mockResolvedValue(null);
    await expect(service.getProductDetails('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getProductDetails throws for inactive product', async () => {
    repository.findProductBySlug.mockResolvedValue({
      id: 'p1',
      slug: 'runner',
      title: 'Runner',
      description: 'desc',
      categoryId: 'c1',
      brand: 'Nike',
      gender: ProductGender.MEN,
      isActive: false,
      isBestSeller: false,
      popularityScore: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: {
        id: 'c1',
        name: 'Men',
        slug: 'men',
        parentId: null,
        level: 0,
        createdAt: new Date(),
      },
      variants: [],
      images: [],
      attributes: [],
      reviews: [],
    } as never);

    await expect(service.getProductDetails('runner')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getProductDetails clears stale cache when size availability is missing', async () => {
    const key = cache.productDetailsKey('runner');
    await cache.set(
      key,
      {
        id: 'p1',
        title: 'Runner',
        description: 'desc',
        price: 99,
        variants: [],
        images: [],
        attributes: {},
        rating: 0,
        reviewsCount: 0,
      },
      60,
    );
    repository.findSizeAvailabilityByProductSlug.mockResolvedValue(null);

    await expect(service.getProductDetails('runner')).rejects.toBeInstanceOf(NotFoundException);
    await expect(cache.get(key)).resolves.toBeUndefined();
    expect(repository.findProductBySlug).not.toHaveBeenCalled();
  });

  it('getFilters uses fallback and builds category-aware options', async () => {
    searchService.getFilters.mockResolvedValue(null);
    repository.listCategories.mockResolvedValue([]);
    repository.getFilterFacets.mockResolvedValue({
      minPrice: 80,
      maxPrice: 120,
      sizes: ['42', '43'],
      genders: ['Men'],
      sports: ['Running'],
    });

    const result = await service.getFilters('men');

    expect(result.priceRanges).toEqual([{ from: 80, to: 120 }]);
    expect(result.sizes).toEqual(['42', '43']);
    expect(result.genders).toEqual(['Men']);
    expect(result.sports).toEqual(['Running']);
  });

  it('getFilters returns elastic filters when available', async () => {
    const elasticFilters = {
      priceRanges: [{ from: 50, to: 180 }],
      sizes: ['41', '42'],
      genders: ['Men'],
      sports: ['Running'],
    };
    searchService.getFilters.mockResolvedValue(elasticFilters);
    repository.listCategories.mockResolvedValue([]);

    const result = await service.getFilters('men');

    expect(result).toEqual(elasticFilters);
    expect(repository.getFilterFacets).not.toHaveBeenCalled();
  });

  it('getRecommendations maps products to list items', async () => {
    repository.findRecommendations.mockResolvedValue([
      {
        id: 'p2',
        title: 'Trail',
        isBestSeller: false,
        variants: [
          { price: '75.00' as never, oldPrice: null, color: 'black', isActive: true, images: [] },
          { price: '90.00' as never, oldPrice: null, color: 'black', isActive: true, images: [] },
        ],
      },
    ] as never);

    const result = await service.getRecommendations('p1');
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(75);
    expect(result[0].colorsCount).toBe(1);
  });

  it('delegates reindex enqueue to producer', async () => {
    await service.enqueueReindex('product-id');
    expect(searchIndexProducer.enqueueProductReindex).toHaveBeenCalledWith('product-id');
  });

  it('delegates product cache invalidation', async () => {
    const invalidateSpy = jest.spyOn(cache, 'invalidateProduct');
    await service.invalidateProductCache('runner', 'men');
    expect(invalidateSpy).toHaveBeenCalledWith('runner', 'men');
  });

  it('delegates category cache invalidation', async () => {
    const invalidateSpy = jest.spyOn(cache, 'invalidateCategory');
    await service.invalidateCategoryCache('men');
    expect(invalidateSpy).toHaveBeenCalledWith('men');
  });
});
