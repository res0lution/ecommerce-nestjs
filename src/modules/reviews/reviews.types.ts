import type { ReviewEntity } from './entities';

export type ReviewListSort = 'latest' | 'rating';

export interface ListProductReviewsInput {
  page: number;
  limit: number;
  sort?: ReviewListSort;
  rating?: number;
}

export interface ProductReviewsListResult {
  items: ReviewEntity[];
  meta: {
    total: number;
    page: number;
  };
}

export interface CreateReviewInput {
  productId: string;
  rating: number;
  title?: string;
  content: string;
  pros?: string;
  cons?: string;
}

export interface UpdateReviewInput {
  rating?: number;
  title?: string;
  content?: string;
  pros?: string;
  cons?: string;
}
