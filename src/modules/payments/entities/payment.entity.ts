import type { PaymentProvider, PaymentStatus } from '@prisma/client';

export interface PaymentEntity {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  providerPaymentId: string | null;
  status: PaymentStatus;
  amount: number;
  currency: string;
  confirmationUrl: string | null;
  idempotenceKey: string | null;
  paidAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentStatusEntity {
  orderId: string;
  status: PaymentStatus;
  confirmationUrl: string | null;
  providerPaymentId: string | null;
}
