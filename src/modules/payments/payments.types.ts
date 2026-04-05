import type { PaymentStatusEntity } from './entities';

export type CreateProviderPaymentInput = {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  returnUrl?: string;
};

export type PaymentStatusResult = PaymentStatusEntity;
