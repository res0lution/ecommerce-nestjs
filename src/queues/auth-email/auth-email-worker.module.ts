import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { NotificationsModule } from '../../modules/notifications/notifications.module';
import { AuthEmailProcessor } from '../processors/auth-email.processor';
import { AUTH_EMAIL_QUEUE } from '../queue.constants';

@Module({
  imports: [NotificationsModule, BullModule.registerQueue({ name: AUTH_EMAIL_QUEUE })],
  providers: [AuthEmailProcessor],
})
export class AuthEmailWorkerModule {}
