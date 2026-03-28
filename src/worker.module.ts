import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { configuration } from './config';
import { AuthEmailWorkerModule } from './queues/auth-email-worker.module';
import { getBullRootOptions } from './queues/bull.config';

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
  ],
})
export class WorkerModule {}
