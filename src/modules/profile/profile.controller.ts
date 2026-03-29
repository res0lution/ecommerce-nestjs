import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AccessPayload, OkResult } from '../auth/auth.types';
import { OkResponseDto } from '../auth/dto/auth-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';
import type { ProfileResult } from './profile.types';

@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly service: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile', type: ProfileResponseDto })
  async getProfile(@CurrentUser() user: AccessPayload): Promise<ProfileResult> {
    return this.service.getProfile(user.sub);
  }

  @Patch()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: 'Updated profile', type: ProfileResponseDto })
  async updateProfile(
    @CurrentUser() user: AccessPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResult> {
    return this.service.updateProfile(user.sub, dto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change current user password' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password changed', type: OkResponseDto })
  async changePassword(
    @CurrentUser() user: AccessPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<OkResult> {
    await this.service.changePassword(user.sub, dto.oldPassword, dto.newPassword);
    return { ok: true };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete current user' })
  @ApiResponse({ status: 200, description: 'Profile deleted', type: OkResponseDto })
  async deleteProfile(@CurrentUser() user: AccessPayload): Promise<OkResult> {
    await this.service.deleteProfile(user.sub);
    return { ok: true };
  }
}
