import { Module } from '@nestjs/common';

import { ProductSearchIndexQueueModule } from '@/queues/product-search-index/product-search-index-queue.module';

import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ReviewsCacheService } from './cache/reviews-cache.service';
import { ReviewsRepository } from './repository/reviews.repository';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [AuthModule, CatalogModule, ProductSearchIndexQueueModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsRepository, ReviewsCacheService],
})
export class ReviewsModule {}
