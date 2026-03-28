import { type BullRootModuleOptions } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

export function getBullRootOptions(config: ConfigService): BullRootModuleOptions {
  return {
    connection: {
      url: config.getOrThrow<string>('redis.url'),
    },
  };
}
