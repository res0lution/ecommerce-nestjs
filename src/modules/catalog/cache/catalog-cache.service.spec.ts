import { ConfigService } from '@nestjs/config';

import type { ProductSearchFilters } from '../catalog.types';
import { CatalogCacheService } from './catalog-cache.service';

function createConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const defaults: Record<string, unknown> = {
    'catalogCache.enabled': true,
    'catalogCache.ttlSeconds.categories': 900,
    'catalogCache.ttlSeconds.filters': 600,
    'catalogCache.ttlSeconds.productsList': 60,
    'catalogCache.ttlSeconds.productDetails': 180,
    'redis.url': '',
  };
  return {
    get<T>(key: string, defaultValue?: T): T {
      const value = key in overrides ? overrides[key] : defaults[key];
      return (value ?? defaultValue) as T;
    },
  } as ConfigService;
}

describe('CatalogCacheService', () => {
  let service: CatalogCacheService;

  beforeEach(() => {
    service = new CatalogCacheService(createConfig());
  });

  it('builds deterministic keys', () => {
    expect(service.categoriesListKey()).toBe('catalog:v1:categories:list');
    expect(service.filtersKey(undefined)).toBe('catalog:v1:filters:all');
    expect(service.filtersKey('men')).toBe('catalog:v1:filters:men');
    expect(service.productDetailsKey('air-max')).toBe('catalog:v1:product:air-max');
  });

  it('generates stable products list key for same query', () => {
    const queryA: ProductSearchFilters = {
      page: 1,
      limit: 20,
      category: 'men',
      sort: 'price_asc',
      size: '42',
      kids: false,
    };
    const queryB: ProductSearchFilters = {
      page: 1,
      limit: 20,
      sort: 'price_asc',
      size: '42',
      category: 'men',
      kids: false,
    };

    expect(service.productsListKey(queryA)).toBe(service.productsListKey(queryB));
  });

  it('stores and reads values using in-memory fallback', async () => {
    await service.set('catalog:v1:test:key', { ok: true }, 5);
    const value = await service.get<{ ok: boolean }>('catalog:v1:test:key');
    expect(value).toEqual({ ok: true });
  });

  it('invalidates product-related keys without delete-all', async () => {
    await service.set(service.productDetailsKey('air-max'), { id: 1 }, 60);
    await service.set(service.productsListKey({ page: 1, limit: 20 }), { total: 1 }, 60);
    await service.set(service.filtersKey('men'), { sizes: ['42'] }, 60);

    await service.invalidateProduct('air-max', 'men');

    expect(await service.get(service.productDetailsKey('air-max'))).toBeUndefined();
    expect(await service.get(service.productsListKey({ page: 1, limit: 20 }))).toBeUndefined();
    expect(await service.get(service.filtersKey('men'))).toBeUndefined();
  });
});
