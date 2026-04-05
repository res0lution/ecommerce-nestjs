import type { ProductGender } from '@prisma/client';

import type { CategoryEntity } from './category.entity';
import type { ProductAttributeEntity } from './product-attribute.entity';
import type { ProductImageEntity } from './product-image.entity';
import type { ProductVariantEntity } from './product-variant.entity';

export interface ProductReviewEntity {
  id: string;
  productId: string;
  userId: string;
  rating: number;
}

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
  ratingAvg: number;
  reviewsCount: number;
  rating1: number;
  rating2: number;
  rating3: number;
  rating4: number;
  rating5: number;
  category: CategoryEntity;
  variants: ProductVariantEntity[];
  images: ProductImageEntity[];
  attributes: ProductAttributeEntity[];
  reviews: ProductReviewEntity[];
}
