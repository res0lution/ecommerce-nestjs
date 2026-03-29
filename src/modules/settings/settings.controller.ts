import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AccessPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SettingsResponseDto } from './dto/settings-response.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';
import type { SettingsResult } from './settings.types';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user settings' })
  @ApiResponse({ status: 200, description: 'User settings', type: SettingsResponseDto })
  async getSettings(@CurrentUser() user: AccessPayload): Promise<SettingsResult> {
    return this.service.getSettings(user.sub);
  }

  @Patch()
  @ApiOperation({ summary: 'Update user settings' })
  @ApiBody({ type: UpdateSettingsDto })
  @ApiResponse({ status: 200, description: 'Updated settings', type: SettingsResponseDto })
  async updateSettings(
    @CurrentUser() user: AccessPayload,
    @Body() dto: UpdateSettingsDto,
  ): Promise<SettingsResult> {
    return this.service.updateSettings(user.sub, dto);
  }
}
