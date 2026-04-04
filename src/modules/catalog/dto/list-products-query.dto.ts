import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListProductsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Category slug' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ enum: ['price_asc', 'price_desc', 'popularity'] })
  @IsIn(['price_asc', 'price_desc', 'popularity'])
  @IsOptional()
  sort?: 'price_asc' | 'price_desc' | 'popularity';

  @ApiPropertyOptional({ description: 'Attribute Gender value' })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiPropertyOptional({ description: 'Use kids category branch', default: false })
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  kids?: boolean;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  priceFrom?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  priceTo?: number;

  @ApiPropertyOptional({ description: 'Attribute Sport value' })
  @IsString()
  @IsOptional()
  sport?: string;

  @ApiPropertyOptional({ description: 'Variant size' })
  @IsString()
  @IsOptional()
  size?: string;
}
