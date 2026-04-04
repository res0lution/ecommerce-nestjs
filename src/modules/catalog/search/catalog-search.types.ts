import type { ProductSearchFilters } from '../catalog.types';

export type CatalogSearchDocument = {
  productId: string;
  slug: string;
  title: string;
  categorySlug: string;
  categoryPath: string[];
  minPrice: number;
  colors: string[];
  sizes: string[];
  attributes: Record<string, string[]>;
  popularity: number;
  isActive: boolean;
};

export type CatalogSearchQuery = ProductSearchFilters & {
  categorySlugs?: string[];
};
