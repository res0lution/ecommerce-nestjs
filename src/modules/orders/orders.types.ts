import type { CheckoutOrderEntity, OrderEntity, OrderListItemEntity } from './entities';

export type CheckoutInput = {
  addressId?: string;
  paymentMethod: 'yookassa';
  returnUrl?: string;
};

export type CheckoutResult = CheckoutOrderEntity;
export type OrderListItemResult = Omit<OrderListItemEntity, 'itemsPreview'> & {
  itemsPreview: Array<{
    title: string;
    image: string | null;
  }>;
};
export type OrderDetailsResult = Omit<OrderEntity, 'items'> & {
  items: Array<{
    id: string;
    productId: string;
    variantId: string;
    title: string;
    image: string | null;
    size: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};
