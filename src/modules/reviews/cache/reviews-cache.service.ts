import { createHash } from 'node:crypto';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import type { ListProductReviewsInput, ProductReviewsListResult } from '../reviews.types';

type CacheEntry = {
  payload: string;
  expiresAt: number;
};

@Injectable()
export class ReviewsCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(ReviewsCacheService.name);
  private readonly keyPrefix = 'reviews:v1';
  private readonly memory = new Map<string, CacheEntry>();
  private readonly enabled: boolean;
  private readonly redisUrl: string;
  private redis: Redis | null = null;
  private redisConnectPromise: Promise<void> | null = null;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<boolean>('reviewsCache.enabled', true);
    this.redisUrl = this.config.get<string>('redis.url', '');
  }

  get reviewsListTtlSeconds(): number {
    return this.config.get<number>('reviewsCache.ttlSeconds.list', 90);
  }

  productReviewsListKey(productId: string, input: ListProductReviewsInput): string {
    const hash = createHash('sha1')
      .update(
        JSON.stringify({
          page: input.page,
          limit: input.limit,
          sort: input.sort,
          rating: input.rating,
        }),
      )
      .digest('hex');
    return `${this.keyPrefix}:list:${productId}:${hash}`;
  }

  productRatingKey(productId: string): string {
    return `${this.keyPrefix}:rating:${productId}`;
  }

  async getReviewsList(key: string): Promise<ProductReviewsListResult | undefined> {
    return this.get<ProductReviewsListResult>(key);
  }

  async setReviewsList(key: string, value: ProductReviewsListResult): Promise<void> {
    await this.set(key, value, this.reviewsListTtlSeconds);
  }

  async invalidateProduct(productId: string): Promise<void> {
    await this.deleteByPattern(`${this.keyPrefix}:list:${productId}:*`);
    await this.delete(this.productRatingKey(productId));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  private async get<T>(key: string): Promise<T | undefined> {
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

  private async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
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

  private async delete(key: string): Promise<void> {
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

  private async deleteByPattern(pattern: string): Promise<void> {
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

    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escaped.replaceAll('*', '.*')}$`);
    for (const key of this.memory.keys()) {
      if (regex.test(key)) {
        this.memory.delete(key);
      }
    }
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
          `Reviews cache will use in-memory fallback because Redis is unavailable: ${
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
}
