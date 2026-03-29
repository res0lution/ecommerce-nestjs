import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateAddressDto {
  @ApiPropertyOptional({ example: 'NL' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'Amsterdam' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Main' })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional({ example: '12' })
  @IsOptional()
  @IsString()
  house?: string;

  @ApiPropertyOptional({ example: '5' })
  @IsOptional()
  @IsString()
  apartment?: string;

  @ApiPropertyOptional({ example: '1000AA' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
