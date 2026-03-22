import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Verification token from email', minLength: 16 })
  @IsString()
  @MinLength(16)
  token!: string;
}
