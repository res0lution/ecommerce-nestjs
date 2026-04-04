import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FiltersQueryDto {
  @ApiPropertyOptional({ description: 'Category slug' })
  @IsString()
  @IsOptional()
  category?: string;
}
