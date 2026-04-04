import type { ReviewStatus } from '@prisma/client';

export type ReviewListSort = 'latest' | 'rating';

export interface ListProductReviewsInput {
  page: number;
  limit: number;
  sort?: ReviewListSort;
  rating?: number;
}

export interface ReviewResult {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  title: string | null;
  content: string;
  pros: string | null;
  cons: string | null;
  isVerifiedPurchase: boolean;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductReviewsListResult {
  items: ReviewResult[];
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
