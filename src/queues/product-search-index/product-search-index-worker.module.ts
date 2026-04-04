import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '@/database/prisma.module';
import { CatalogCacheService } from '@/modules/catalog/cache/catalog-cache.service';
import { CatalogRepository } from '@/modules/catalog/repository/catalog.repository';
import { CatalogSearchService } from '@/modules/catalog/search/catalog-search.service';

import { ProductSearchIndexProcessor } from '../processors/product-search-index.processor';
import { PRODUCT_SEARCH_INDEX_QUEUE } from '../queue.constants';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullModule.registerQueue({ name: PRODUCT_SEARCH_INDEX_QUEUE }),
  ],
  providers: [
    CatalogCacheService,
    CatalogRepository,
    CatalogSearchService,
    ProductSearchIndexProcessor,
  ],
})
export class ProductSearchIndexWorkerModule {}
