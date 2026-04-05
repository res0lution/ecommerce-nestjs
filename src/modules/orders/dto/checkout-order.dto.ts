import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUrl, IsUUID } from 'class-validator';

export class CheckoutOrderDto {
  @ApiProperty({ format: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  addressId?: string;

  @ApiProperty({ enum: ['yookassa'] })
  @IsIn(['yookassa'])
  paymentMethod!: 'yookassa';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  returnUrl?: string;
}
