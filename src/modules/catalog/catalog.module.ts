import { Module } from '@nestjs/common';

import { ProductSearchIndexQueueModule } from '@/queues/product-search-index/product-search-index-queue.module';

import { CatalogCacheService } from './cache/catalog-cache.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogRepository } from './repository/catalog.repository';
import { CatalogSearchService } from './search/catalog-search.service';

@Module({
  imports: [ProductSearchIndexQueueModule],
  controllers: [CatalogController],
  providers: [CatalogCacheService, CatalogService, CatalogRepository, CatalogSearchService],
  exports: [CatalogCacheService, CatalogRepository, CatalogSearchService],
})
export class CatalogModule {}
