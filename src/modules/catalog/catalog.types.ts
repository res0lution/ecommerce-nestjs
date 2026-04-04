import type { CategoryEntity, ProductEntity } from './entities';

export type CatalogSort = 'price_asc' | 'price_desc' | 'popularity';

export type ProductListItem = {
  id: string;
  title: string;
  price: number;
  image: string | null;
  badges: string[];
  colorsCount: number;
};

export type ProductListResponse = {
  items: ProductListItem[];
  total: number;
};

export type ProductFiltersResponse = {
  priceRanges: Array<{ from: number; to: number }>;
  sizes: string[];
  genders: string[];
  sports: string[];
};

export type ProductVariantCard = {
  id: string;
  color: string;
  images: string[];
};

export type ProductSizeAvailability = {
  size: string;
  available: boolean;
};

export type ProductDetailsResponse = {
  id: string;
  title: string;
  description: string;
  price: number;
  variants: ProductVariantCard[];
  sizes: ProductSizeAvailability[];
  images: string[];
  attributes: Record<string, string[]>;
  rating: number;
  reviewsCount: number;
};

export type CategoryTreeNode = {
  id: string;
  name: string;
  slug: string;
  children: CategoryTreeNode[];
};

export type ProductSearchFilters = {
  page: number;
  limit: number;
  category?: string;
  sort?: CatalogSort;
  gender?: string;
  kids?: boolean;
  priceFrom?: number;
  priceTo?: number;
  sport?: string;
  size?: string;
};

export type CategoryResult = CategoryEntity;
export type ProductResult = ProductEntity;
