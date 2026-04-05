import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

export class PaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  orderId!: string;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ nullable: true, required: false })
  confirmationUrl!: string | null;

  @ApiProperty({ nullable: true, required: false })
  providerPaymentId!: string | null;
}
