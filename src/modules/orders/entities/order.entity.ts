import type { OrderStatus, PaymentStatus } from '@prisma/client';

import type { OrderItemEntity, OrderItemPreviewEntity } from './order-item.entity';

export interface CheckoutPaymentEntity {
  status: PaymentStatus;
  confirmationUrl: string | null;
}

export interface CheckoutOrderEntity {
  orderId: string;
  orderNumber: string;
  payment: CheckoutPaymentEntity;
}

export interface OrderListItemEntity {
  orderId: string;
  orderNumber: string;
  statusLabel: OrderStatus;
  statusDate: Date;
  itemsPreview: OrderItemPreviewEntity[];
  totalAmount: number;
  canCancel: boolean;
}

export interface OrderEntity {
  id: string;
  number: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  currency: string;
  subtotal: number;
  deliveryAmount: number;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
  deliveryEta: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  items: OrderItemEntity[];
  canCancel: boolean;
}
