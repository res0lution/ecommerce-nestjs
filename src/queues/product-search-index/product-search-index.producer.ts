import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { type JobsOptions, Queue } from 'bullmq';

import {
  ProductSearchIndexJobName,
  type ProductSearchIndexPayload,
} from '../product-search-index/product-search-index.types';
import { PRODUCT_SEARCH_INDEX_QUEUE } from '../queue.constants';

@Injectable()
export class ProductSearchIndexProducer {
  constructor(
    @InjectQueue(PRODUCT_SEARCH_INDEX_QUEUE)
    private readonly queue: Queue<ProductSearchIndexPayload>,
  ) {}

  async enqueueProductReindex(productId: string): Promise<void> {
    await this.queue.add(
      ProductSearchIndexJobName.ReindexProduct,
      { productId },
      this.jobOptions(productId),
    );
  }

  private jobOptions(productId: string): JobsOptions {
    return {
      jobId: productId,
      attempts: 3,
      backoff: {
        type: 'exponential' as const,
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: 50,
    };
  }
}
