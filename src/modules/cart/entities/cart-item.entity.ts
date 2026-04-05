import type { Prisma } from '@prisma/client';

export interface CartItemEntity {
  id: string;
  cartId: string;
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
}
