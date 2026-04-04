import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { CatalogCacheService } from '@/modules/catalog/cache/catalog-cache.service';
import { CatalogRepository } from '@/modules/catalog/repository/catalog.repository';
import { CatalogSearchService } from '@/modules/catalog/search/catalog-search.service';

import {
  ProductSearchIndexJobName,
  type ProductSearchIndexPayload,
} from '../product-search-index/product-search-index.types';
import { PRODUCT_SEARCH_INDEX_QUEUE } from '../queue.constants';

@Injectable()
@Processor(PRODUCT_SEARCH_INDEX_QUEUE)
export class ProductSearchIndexProcessor extends WorkerHost {
  private readonly logger = new Logger(ProductSearchIndexProcessor.name);

  constructor(
    private readonly cache: CatalogCacheService,
    private readonly repository: CatalogRepository,
    private readonly searchService: CatalogSearchService,
  ) {
    super();
  }

  async process(job: Job<ProductSearchIndexPayload>): Promise<void> {
    switch (job.name as ProductSearchIndexJobName) {
      case ProductSearchIndexJobName.ReindexProduct: {
        const product = await this.repository.findProductForIndex(job.data.productId);
        if (!product) {
          return;
        }

        const prices = product.variants.map((variant) => Number(variant.price));
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const colors = [...new Set(product.variants.map((variant) => variant.color))];
        const sizes = [...new Set(product.variants.map((variant) => variant.size))];
        const attributes = product.attributes.reduce<Record<string, string[]>>((acc, entry) => {
          const key = entry.name;
          const list = acc[key] ?? [];
          if (!list.includes(entry.value)) {
            list.push(entry.value);
          }
          acc[key] = list;
          return acc;
        }, {});
        const categoryPath = [product.category.slug];

        await this.searchService.indexProduct({
          productId: product.id,
          slug: product.slug,
          title: product.title,
          categorySlug: product.category.slug,
          categoryPath,
          minPrice,
          colors,
          sizes,
          attributes,
          popularity: product.popularityScore + Math.round(product.ratingAvg * 10),
          isActive: product.isActive,
        });
        await this.cache.invalidateProduct(product.slug, product.category.slug);
        return;
      }
      default:
        throw new Error(`Unsupported product index job: ${job.name}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ProductSearchIndexPayload> | undefined, error: Error): void {
    const jobId = job?.id ?? 'unknown';
    this.logger.error(`Product search indexing job failed id=${jobId}: ${error.message}`);
  }
}
