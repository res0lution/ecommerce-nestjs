import type { ReviewStatus } from '@prisma/client';

export interface ReviewEntity {
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
