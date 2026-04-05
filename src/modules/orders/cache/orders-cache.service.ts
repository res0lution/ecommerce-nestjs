import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

type CacheEntry = {
  payload: string;
  expiresAt: number;
};

@Injectable()
export class OrdersCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(OrdersCacheService.name);
  private readonly keyPrefix = 'commerce:v1';
  private readonly memory = new Map<string, CacheEntry>();
  private readonly enabled: boolean;
  private readonly redisUrl: string;
  private readonly ttls: {
    ordersList: number;
    orderDetails: number;
  };
  private redis: Redis | null = null;
  private redisConnectPromise: Promise<void> | null = null;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<boolean>('commerceCache.enabled', true);
    this.redisUrl = this.config.get<string>('redis.url', '');
    this.ttls = {
      ordersList: this.config.get<number>('commerceCache.ttlSeconds.ordersList', 60),
      orderDetails: this.config.get<number>('commerceCache.ttlSeconds.orderDetails', 90),
    };
  }

  get ordersListTtlSeconds(): number {
    return this.ttls.ordersList;
  }

  get orderDetailsTtlSeconds(): number {
    return this.ttls.orderDetails;
  }

  ordersListKey(userId: string): string {
    return `${this.keyPrefix}:orders:list:${userId}`;
  }

  cartKey(userId: string): string {
    return `${this.keyPrefix}:cart:${userId}`;
  }

  orderDetailsKey(userId: string, orderId: string): string {
    return `${this.keyPrefix}:orders:details:${userId}:${orderId}`;
  }

  async invalidateCart(userId: string): Promise<void> {
    await this.delete(this.cartKey(userId));
  }

  async invalidateOrderDetails(userId: string, orderId: string): Promise<void> {
    await this.delete(this.orderDetailsKey(userId, orderId));
  }

  async invalidateOrdersForUser(userId: string): Promise<void> {
    await this.delete(this.ordersListKey(userId));
    await this.deleteByPattern(`${this.keyPrefix}:orders:details:${userId}:*`);
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
          `Orders cache will use in-memory fallback because Redis is unavailable: ${
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
