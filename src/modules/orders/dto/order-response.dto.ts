import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, PaymentStatus } from '@prisma/client';

export class CheckoutPaymentResponseDto {
  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ nullable: true, required: false })
  confirmationUrl!: string | null;
}

export class CheckoutOrderResponseDto {
  @ApiProperty({ format: 'uuid' })
  orderId!: string;

  @ApiProperty()
  orderNumber!: string;

  @ApiProperty({ type: CheckoutPaymentResponseDto })
  payment!: CheckoutPaymentResponseDto;
}

export class OrderListPreviewItemDto {
  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true, required: false })
  image!: string | null;
}

export class OrderListItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  orderId!: string;

  @ApiProperty()
  orderNumber!: string;

  @ApiProperty({ enum: OrderStatus })
  statusLabel!: OrderStatus;

  @ApiProperty()
  statusDate!: Date;

  @ApiProperty({ type: OrderListPreviewItemDto, isArray: true })
  itemsPreview!: OrderListPreviewItemDto[];

  @ApiProperty()
  totalAmount!: number;

  @ApiProperty()
  canCancel!: boolean;
}

export class OrderDetailsItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

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
  quantity!: number;

  @ApiProperty()
  unitPrice!: number;

  @ApiProperty()
  lineTotal!: number;
}

export class OrderDetailsResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  number!: string;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus!: PaymentStatus;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  subtotal!: number;

  @ApiProperty()
  deliveryAmount!: number;

  @ApiProperty()
  totalAmount!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ nullable: true, required: false })
  deliveryEta!: Date | null;

  @ApiProperty({ nullable: true, required: false })
  deliveredAt!: Date | null;

  @ApiProperty({ nullable: true, required: false })
  cancelledAt!: Date | null;

  @ApiProperty({ nullable: true, required: false })
  cancelReason!: string | null;

  @ApiProperty({ type: OrderDetailsItemDto, isArray: true })
  items!: OrderDetailsItemDto[];

  @ApiProperty()
  canCancel!: boolean;
}
