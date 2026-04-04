import { Client } from '@elastic/elasticsearch';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ProductFiltersResponse, ProductListResponse } from '../catalog.types';
import type { CatalogSearchDocument, CatalogSearchQuery } from './catalog-search.types';

@Injectable()
export class CatalogSearchService implements OnModuleDestroy {
  private readonly logger = new Logger(CatalogSearchService.name);
  private readonly enabled: boolean;
  private readonly indexName: string;
  private readonly client: Client | null;

  constructor(config: ConfigService) {
    this.enabled = config.get<boolean>('elasticsearch.enabled', false);
    this.indexName = config.get<string>('elasticsearch.productsIndex', 'products_v1');
    if (!this.enabled) {
      this.client = null;
      return;
    }

    const node = config.get<string>('elasticsearch.node', '');
    const username = config.get<string>('elasticsearch.username', '');
    const password = config.get<string>('elasticsearch.password', '');
    const apiKey = config.get<string>('elasticsearch.apiKey', '');
    const auth =
      apiKey.length > 0
        ? { apiKey }
        : username.length > 0 && password.length > 0
          ? { username, password }
          : undefined;

    this.client = new Client({
      node,
      maxRetries: 0,
      requestTimeout: 800,
      ...(auth ? { auth } : {}),
    });
  }

  isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }
    await this.client.close();
  }

  async indexProduct(document: CatalogSearchDocument): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.index({
      index: this.indexName,
      id: document.productId,
      document,
      refresh: false,
    });
  }

  async searchProducts(query: CatalogSearchQuery): Promise<ProductListResponse | null> {
    if (!this.client) {
      return null;
    }

    try {
      const sizes = this.normalizeMatchValues(query.size);
      const sports = this.normalizeMatchValues(query.sport);
      const genders = this.normalizeMatchValues(query.gender);
      const result = await this.client.search<CatalogSearchDocument>({
        index: this.indexName,
        from: (query.page - 1) * query.limit,
        size: query.limit,
        query: {
          bool: {
            filter: [
              { term: { isActive: true } },
              ...(query.categorySlugs !== undefined && query.categorySlugs.length > 0
                ? [{ terms: { categoryPath: query.categorySlugs } }]
                : []),
              ...(sizes.length > 0 ? [{ terms: { 'sizes.keyword': sizes } }] : []),
              ...(sports.length > 0 ? [{ terms: { 'attributes.Sport.keyword': sports } }] : []),
              ...(genders.length > 0 ? [{ terms: { 'attributes.Gender.keyword': genders } }] : []),
              ...(query.priceFrom !== undefined || query.priceTo !== undefined
                ? [
                    {
                      range: {
                        minPrice: {
                          ...(query.priceFrom !== undefined ? { gte: query.priceFrom } : {}),
                          ...(query.priceTo !== undefined ? { lte: query.priceTo } : {}),
                        },
                      },
                    },
                  ]
                : []),
            ],
          },
        },
        sort: this.resolveSort(query.sort),
      });

      const hits = result.hits.hits;
      const items = hits.map((hit) => {
        const source = hit._source;
        if (!source) {
          return null;
        }
        return {
          id: source.productId,
          title: source.title,
          price: source.minPrice,
          image: null,
          badges: [],
          colorsCount: source.colors.length,
        };
      });

      const total =
        typeof result.hits.total === 'number' ? result.hits.total : (result.hits.total?.value ?? 0);

      return {
        items: items.filter((item): item is NonNullable<typeof item> => item !== null),
        total,
      };
    } catch (error) {
      this.logger.warn(
        `Elasticsearch search failed, fallback to database path will be used: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async getFilters(query: CatalogSearchQuery): Promise<ProductFiltersResponse | null> {
    if (!this.client) {
      return null;
    }

    try {
      const response = await this.client.search<CatalogSearchDocument>({
        index: this.indexName,
        size: 0,
        query: {
          bool: {
            filter: [
              { term: { isActive: true } },
              ...(query.categorySlugs !== undefined && query.categorySlugs.length > 0
                ? [{ terms: { categoryPath: query.categorySlugs } }]
                : []),
            ],
          },
        },
        aggs: {
          minPrice: { min: { field: 'minPrice' } },
          maxPrice: { max: { field: 'minPrice' } },
          sizes: { terms: { field: 'sizes.keyword', size: 50 } },
          genders: { terms: { field: 'attributes.Gender.keyword', size: 10 } },
          sports: { terms: { field: 'attributes.Sport.keyword', size: 25 } },
        },
      });

      const minValue = this.readAggNumber(response.aggregations?.minPrice);
      const maxValue = this.readAggNumber(response.aggregations?.maxPrice);

      const readBuckets = (aggName: 'sizes' | 'genders' | 'sports'): string[] => {
        const aggregation = response.aggregations?.[aggName];
        if (!aggregation || !('buckets' in aggregation)) {
          return [];
        }
        type Bucket = { key: string | number };
        return (aggregation.buckets as Bucket[])
          .map((bucket: Bucket) => String(bucket.key))
          .filter((value: string) => value.length > 0);
      };

      return {
        priceRanges: minValue > 0 || maxValue > 0 ? [{ from: minValue, to: maxValue }] : [],
        sizes: readBuckets('sizes'),
        genders: readBuckets('genders'),
        sports: readBuckets('sports'),
      };
    } catch (error) {
      this.logger.warn(
        `Elasticsearch filters failed, fallback to database path will be used: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private resolveSort(sort: CatalogSearchQuery['sort']): Array<Record<string, 'asc' | 'desc'>> {
    if (sort === 'price_asc') {
      return [{ minPrice: 'asc' }];
    }
    if (sort === 'price_desc') {
      return [{ minPrice: 'desc' }];
    }
    return [{ popularity: 'desc' }];
  }

  private normalizeMatchValues(raw: string | undefined): string[] {
    if (raw === undefined || raw.trim().length === 0) {
      return [];
    }
    return [
      ...new Set(
        raw
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    ];
  }

  private readAggNumber(aggregation: unknown): number {
    if (aggregation === null || typeof aggregation !== 'object' || !('value' in aggregation)) {
      return 0;
    }
    const value = Number(aggregation.value);
    return Number.isFinite(value) ? value : 0;
  }
}
