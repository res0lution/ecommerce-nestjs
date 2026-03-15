import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { configuration } from './config';
import { PrismaModule } from './database/prisma.module';

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
    PrismaModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
