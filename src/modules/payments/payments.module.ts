import { Module } from '@nestjs/common';

import { PaymentsCacheService } from './cache/payments-cache.service';
import { YooKassaClient } from './clients/yookassa.client';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './repository/payments.repository';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository, YooKassaClient, PaymentsCacheService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
