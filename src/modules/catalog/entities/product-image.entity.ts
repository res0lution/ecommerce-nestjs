export interface ProductImageEntity {
  id: string;
  productId: string;
  variantId: string | null;
  url: string;
  sortOrder: number;
}
