import type { ProductGender } from '@prisma/client';

import type { CategoryEntity } from './category.entity';
import type { ProductAttributeEntity } from './product-attribute.entity';
import type { ProductImageEntity } from './product-image.entity';
import type { ProductVariantEntity } from './product-variant.entity';
import type { ReviewEntity } from './review.entity';

export interface ProductEntity {
  id: string;
  title: string;
  slug: string;
  description: string;
  categoryId: string;
  brand: string;
  gender: ProductGender;
  isActive: boolean;
  isBestSeller: boolean;
  popularityScore: number;
  category: CategoryEntity;
  variants: ProductVariantEntity[];
  images: ProductImageEntity[];
  attributes: ProductAttributeEntity[];
  reviews: ReviewEntity[];
}
