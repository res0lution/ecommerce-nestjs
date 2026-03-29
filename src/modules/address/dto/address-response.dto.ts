import { ApiProperty } from '@nestjs/swagger';

export class AddressResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'NL' })
  country!: string;

  @ApiProperty({ example: 'Amsterdam' })
  city!: string;

  @ApiProperty({ example: 'Main' })
  street!: string;

  @ApiProperty({ example: '12' })
  house!: string;

  @ApiProperty({ example: '5', nullable: true })
  apartment!: string | null;

  @ApiProperty({ example: '1000AA' })
  postalCode!: string;

  @ApiProperty({ example: true })
  isDefault!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
