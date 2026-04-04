import { ApiProperty } from '@nestjs/swagger';
import { ReviewStatus } from '@prisma/client';

export class ReviewResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  rating!: number;

  @ApiProperty({ nullable: true, required: false })
  title!: string | null;

  @ApiProperty()
  content!: string;

  @ApiProperty({ nullable: true, required: false })
  pros!: string | null;

  @ApiProperty({ nullable: true, required: false })
  cons!: string | null;

  @ApiProperty()
  isVerifiedPurchase!: boolean;

  @ApiProperty({ enum: ReviewStatus })
  status!: ReviewStatus;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ProductReviewsMetaDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;
}

export class ProductReviewsListResponseDto {
  @ApiProperty({ type: ReviewResponseDto, isArray: true })
  items!: ReviewResponseDto[];

  @ApiProperty({ type: ProductReviewsMetaDto })
  meta!: ProductReviewsMetaDto;
}
