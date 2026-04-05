import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { BullModule } from '@nestjs/bullmq';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { configuration } from './config';
import { PrismaModule } from './database/prisma.module';
import { AddressModule } from './modules/address/address.module';
import { AuthModule } from './modules/auth/auth.module';
import { CartModule } from './modules/cart/cart.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProfileModule } from './modules/profile/profile.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SettingsModule } from './modules/settings/settings.module';
import { getBullRootOptions } from './queues/bull.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
    }),
    LoggerModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const level = config.get<string>('logger.level', 'info');
        const usePretty = config.get<boolean>('logger.usePretty', false);
        return {
          pinoHttp: {
            level,
            transport: usePretty
              ? {
                  target: 'pino-pretty',
                  options: { singleLine: true },
                }
              : undefined,
          },
        };
      },
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const throttlers = [
          {
            ttl: 60000,
            limit: 100,
          },
        ];
        const nodeEnv = config.get<string>('nodeEnv');

        if (nodeEnv === 'test') {
          return { throttlers };
        }

        return {
          throttlers,
          storage: new ThrottlerStorageRedisService(config.getOrThrow<string>('redis.url')),
        };
      },
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getBullRootOptions,
    }),
    PrismaModule,
    NotificationsModule,
    AuthModule,
    ProfileModule,
    AddressModule,
    SettingsModule,
    CatalogModule,
    ReviewsModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
