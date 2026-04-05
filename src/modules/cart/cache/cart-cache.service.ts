import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

type CacheEntry = {
  payload: string;
  expiresAt: number;
};

@Injectable()
export class CartCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CartCacheService.name);
  private readonly keyPrefix = 'commerce:v1';
  private readonly memory = new Map<string, CacheEntry>();
  private readonly enabled: boolean;
  private readonly redisUrl: string;
  private readonly cartTtl: number;
  private redis: Redis | null = null;
  private redisConnectPromise: Promise<void> | null = null;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<boolean>('commerceCache.enabled', true);
    this.redisUrl = this.config.get<string>('redis.url', '');
    this.cartTtl = this.config.get<number>('commerceCache.ttlSeconds.cart', 30);
  }

  get cartTtlSeconds(): number {
    return this.cartTtl;
  }

  cartKey(userId: string): string {
    return `${this.keyPrefix}:cart:${userId}`;
  }

  async invalidateCart(userId: string): Promise<void> {
    await this.delete(this.cartKey(userId));
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

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
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
          `Cart cache will use in-memory fallback because Redis is unavailable: ${
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
