import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { configuration } from './config';
import { AuthEmailWorkerModule } from './queues/auth-email/auth-email-worker.module';
import { getBullRootOptions } from './queues/bull.config';
import { ProductSearchIndexWorkerModule } from './queues/product-search-index/product-search-index-worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getBullRootOptions,
    }),
    AuthEmailWorkerModule,
    ProductSearchIndexWorkerModule,
  ],
})
export class WorkerModule {}
