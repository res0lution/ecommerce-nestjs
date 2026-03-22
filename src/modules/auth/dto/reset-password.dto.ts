import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token from email link', minLength: 16 })
  @IsString()
  @MinLength(16)
  token!: string;

  @ApiProperty({ example: 'newSecurePassword8', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
