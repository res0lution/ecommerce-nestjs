import type { PaymentProvider } from '@prisma/client';

export interface PaymentWebhookEventEntity {
  id: string;
  provider: PaymentProvider;
  eventId: string;
  eventType: string;
  processedAt: Date;
}
