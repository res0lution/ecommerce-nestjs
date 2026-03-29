import { ApiProperty } from '@nestjs/swagger';

export class SettingsResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ example: 'en' })
  language!: string;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ example: true })
  notificationsEnabled!: boolean;
}
