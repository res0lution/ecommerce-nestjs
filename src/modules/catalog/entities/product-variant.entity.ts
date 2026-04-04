import type { ProductImageEntity } from './product-image.entity';

export interface ProductVariantEntity {
  id: string;
  productId: string;
  sku: string;
  price: number;
  oldPrice: number | null;
  color: string;
  size: string;
  stock: number;
  isActive: boolean;
  images: ProductImageEntity[];
}
