import { ApiProperty } from '@nestjs/swagger';

export class CartItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  itemId!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  variantId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true, required: false })
  image!: string | null;

  @ApiProperty({ nullable: true, required: false })
  size!: string | null;

  @ApiProperty()
  price!: number;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  lineTotal!: number;
}

export class CartResponseDto {
  @ApiProperty({ type: CartItemResponseDto, isArray: true })
  items!: CartItemResponseDto[];

  @ApiProperty()
  subtotal!: number;

  @ApiProperty()
  deliveryAmount!: number;

  @ApiProperty()
  totalAmount!: number;
}
