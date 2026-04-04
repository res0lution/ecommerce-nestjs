import { ApiProperty } from '@nestjs/swagger';

export class CategoryTreeNodeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ type: () => CategoryTreeNodeDto, isArray: true })
  children!: CategoryTreeNodeDto[];
}

export class ProductListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  price!: number;

  @ApiProperty({ nullable: true })
  image!: string | null;

  @ApiProperty({ type: [String] })
  badges!: string[];

  @ApiProperty()
  colorsCount!: number;
}

export class ProductListResponseDto {
  @ApiProperty({ type: ProductListItemDto, isArray: true })
  items!: ProductListItemDto[];

  @ApiProperty()
  total!: number;
}

export class ProductFiltersResponseDto {
  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        from: { type: 'number' },
        to: { type: 'number' },
      },
    },
  })
  priceRanges!: Array<{ from: number; to: number }>;

  @ApiProperty({ type: [String] })
  sizes!: string[];

  @ApiProperty({ type: [String] })
  genders!: string[];

  @ApiProperty({ type: [String] })
  sports!: string[];
}

export class ProductVariantCardDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  color!: string;

  @ApiProperty({ type: [String] })
  images!: string[];
}

export class ProductSizeAvailabilityDto {
  @ApiProperty()
  size!: string;

  @ApiProperty()
  available!: boolean;
}

export class ProductDetailsResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  price!: number;

  @ApiProperty({ type: ProductVariantCardDto, isArray: true })
  variants!: ProductVariantCardDto[];

  @ApiProperty({ type: ProductSizeAvailabilityDto, isArray: true })
  sizes!: ProductSizeAvailabilityDto[];

  @ApiProperty({ type: [String] })
  images!: string[];

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
  })
  attributes!: Record<string, string[]>;

  @ApiProperty()
  rating!: number;

  @ApiProperty()
  reviewsCount!: number;
}
