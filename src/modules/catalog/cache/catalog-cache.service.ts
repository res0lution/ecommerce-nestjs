import { createHash } from 'node:crypto';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import type { ProductSearchFilters } from '../catalog.types';

type CacheEntry = {
  payload: string;
  expiresAt: number;
};

@Injectable()
export class CatalogCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CatalogCacheService.name);
  private readonly keyPrefix = 'catalog:v1';
  private readonly memory = new Map<string, CacheEntry>();
  private readonly enabled: boolean;
  private readonly ttls: {
    categories: number;
    filters: number;
    productsList: number;
    productDetails: number;
  };
  private readonly redisUrl: string;
  private redis: Redis | null = null;
  private redisConnectPromise: Promise<void> | null = null;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<boolean>('catalogCache.enabled', true);
    this.ttls = {
      categories: this.config.get<number>('catalogCache.ttlSeconds.categories', 900),
      filters: this.config.get<number>('catalogCache.ttlSeconds.filters', 600),
      productsList: this.config.get<number>('catalogCache.ttlSeconds.productsList', 60),
      productDetails: this.config.get<number>('catalogCache.ttlSeconds.productDetails', 180),
    };
    this.redisUrl = this.config.get<string>('redis.url', '');
  }

  get categoriesTtlSeconds(): number {
    return this.ttls.categories;
  }

  get filtersTtlSeconds(): number {
    return this.ttls.filters;
  }

  get productsListTtlSeconds(): number {
    return this.ttls.productsList;
  }

  get productDetailsTtlSeconds(): number {
    return this.ttls.productDetails;
  }

  categoriesListKey(): string {
    return `${this.keyPrefix}:categories:list`;
  }

  filtersKey(category?: string): string {
    return `${this.keyPrefix}:filters:${category ?? 'all'}`;
  }

  productsListKey(filters: ProductSearchFilters): string {
    const hash = this.hashValue(this.normalizeFiltersForHash(filters));
    return `${this.keyPrefix}:products:${hash}`;
  }

  productDetailsKey(slug: string): string {
    return `${this.keyPrefix}:product:${slug}`;
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.enabled) {
      return undefined;
    }
    const redis = await this.getRedisClient();
    if (redis) {
      const raw = await redis.get(key);
      if (raw === null) {
        return undefined;
      }
      return JSON.parse(raw) as T;
    }
    const entry = this.memory.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.memory.delete(key);
      return undefined;
    }
    return JSON.parse(entry.payload) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!this.enabled) {
      return;
    }
    const payload = JSON.stringify(value);
    const redis = await this.getRedisClient();
    if (redis) {
      await redis.set(key, payload, 'EX', ttlSeconds);
      return;
    }
    this.memory.set(key, {
      payload,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    if (!this.enabled) {
      return;
    }
    const redis = await this.getRedisClient();
    if (redis) {
      await redis.del(key);
      return;
    }
    this.memory.delete(key);
  }

  async deleteByPattern(pattern: string): Promise<void> {
    if (!this.enabled) {
      return;
    }
    const redis = await this.getRedisClient();
    if (redis) {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redis.unlink(...keys);
        }
      } while (cursor !== '0');
      return;
    }

    const regex = this.patternToRegex(pattern);
    for (const key of this.memory.keys()) {
      if (regex.test(key)) {
        this.memory.delete(key);
      }
    }
  }

  async invalidateProduct(slug: string, categorySlug?: string): Promise<void> {
    await this.delete(this.productDetailsKey(slug));
    await this.deleteByPattern(`${this.keyPrefix}:products:*`);
    await this.deleteByPattern(`${this.keyPrefix}:filters:*`);
    if (this.hasNonEmptyText(categorySlug)) {
      await this.delete(this.filtersKey(categorySlug));
    }
  }

  async invalidateCategory(categorySlug?: string): Promise<void> {
    await this.delete(this.categoriesListKey());
    await this.deleteByPattern(`${this.keyPrefix}:products:*`);
    await this.deleteByPattern(`${this.keyPrefix}:filters:*`);
    if (this.hasNonEmptyText(categorySlug)) {
      await this.delete(this.filtersKey(categorySlug));
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  private normalizeFiltersForHash(filters: ProductSearchFilters): ProductSearchFilters {
    return {
      page: filters.page,
      limit: filters.limit,
      ...(this.hasNonEmptyText(filters.category) ? { category: filters.category } : {}),
      ...(this.hasNonEmptyText(filters.sort) ? { sort: filters.sort } : {}),
      ...(this.hasNonEmptyText(filters.gender) ? { gender: filters.gender } : {}),
      ...(filters.kids !== undefined ? { kids: filters.kids } : {}),
      ...(filters.priceFrom !== undefined ? { priceFrom: filters.priceFrom } : {}),
      ...(filters.priceTo !== undefined ? { priceTo: filters.priceTo } : {}),
      ...(this.hasNonEmptyText(filters.sport) ? { sport: filters.sport } : {}),
      ...(this.hasNonEmptyText(filters.size) ? { size: filters.size } : {}),
    };
  }

  private hasNonEmptyText(value: string | undefined): value is string {
    return value !== undefined && value.trim().length > 0;
  }

  private hashValue(value: unknown): string {
    return createHash('sha1').update(JSON.stringify(value)).digest('hex');
  }

  private async getRedisClient(): Promise<Redis | null> {
    if (!this.enabled || this.redisUrl.length === 0) {
      return null;
    }
    if (this.redis !== null) {
      return this.redis;
    }
    if (this.redisConnectPromise) {
      await this.redisConnectPromise;
      return this.redis;
    }

    const client = new Redis(this.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.redisConnectPromise = client
      .connect()
      .then(() => {
        this.redis = client;
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Catalog cache will use in-memory fallback because Redis is unavailable: ${
            (error as Error).message
          }`,
        );
      })
      .finally(() => {
        this.redisConnectPromise = null;
      });
    await this.redisConnectPromise;
    return this.redis;
  }

  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped.replaceAll('*', '.*')}$`);
  }
}
