import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateAddressDto {
  @ApiProperty({ example: 'NL' })
  @IsString()
  country!: string;

  @ApiProperty({ example: 'Amsterdam' })
  @IsString()
  city!: string;

  @ApiProperty({ example: 'Main' })
  @IsString()
  street!: string;

  @ApiProperty({ example: '12' })
  @IsString()
  house!: string;

  @ApiPropertyOptional({ example: '5' })
  @IsOptional()
  @IsString()
  apartment?: string;

  @ApiProperty({ example: '1000AA' })
  @IsString()
  postalCode!: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
