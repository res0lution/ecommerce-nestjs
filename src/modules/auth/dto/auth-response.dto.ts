import { ApiProperty } from '@nestjs/swagger';

export class AuthUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'John Doe', nullable: true })
  name!: string | null;
}

export class AuthTokensResponseDto {
  @ApiProperty({ type: AuthUserResponseDto })
  user!: AuthUserResponseDto;

  @ApiProperty({ description: 'JWT access token' })
  accessToken!: string;

  @ApiProperty({ description: 'Refresh token (also set in httpOnly cookie)' })
  refreshToken!: string;
}

export class RefreshResponseDto {
  @ApiProperty({ description: 'New JWT access token' })
  accessToken!: string;
}

export class OkResponseDto {
  @ApiProperty({ example: true })
  ok!: true;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'If the email exists, a reset link was sent' })
  message!: string;
}
