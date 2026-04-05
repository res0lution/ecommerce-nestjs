export interface OrderItemPreviewEntity {
  titleSnapshot: string;
  imageUrlSnapshot: string | null;
}

export interface OrderItemEntity {
  id: string;
  productId: string;
  variantId: string;
  titleSnapshot: string;
  imageUrlSnapshot: string | null;
  sizeSnapshot: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}
