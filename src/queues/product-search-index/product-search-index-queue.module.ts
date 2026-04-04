import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { PRODUCT_SEARCH_INDEX_QUEUE } from '../queue.constants';
import { ProductSearchIndexProducer } from './product-search-index.producer';

@Module({
  imports: [BullModule.registerQueue({ name: PRODUCT_SEARCH_INDEX_QUEUE })],
  providers: [ProductSearchIndexProducer],
  exports: [ProductSearchIndexProducer],
})
export class ProductSearchIndexQueueModule {}
