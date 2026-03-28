import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { AuthEmailProducer } from './auth-email.producer';
import { AUTH_EMAIL_QUEUE } from './queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: AUTH_EMAIL_QUEUE })],
  providers: [AuthEmailProducer],
  exports: [AuthEmailProducer],
})
export class AuthEmailQueueModule {}
