import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthProvider } from '@prisma/client';
import * as argon2 from 'argon2';

import { TokenService } from '../auth/token.service';
import type { ProfileResult, UpdateProfileInput } from './profile.types';
import { ProfileRepository } from './repository/profile.repository';

@Injectable()
export class ProfileService {
  constructor(
    private readonly repository: ProfileRepository,
    private readonly tokenService: TokenService,
  ) {}

  async getProfile(userId: string): Promise<ProfileResult> {
    const user = await this.repository.findActiveProfileByUserId(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<ProfileResult> {
    const existing = await this.repository.findActiveProfileByUserId(userId);
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    return this.repository.updateProfile(userId, input);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const state = await this.repository.findUserPasswordState(userId);
    if (!state || state.deletedAt !== null) {
      throw new NotFoundException('User not found');
    }
    if (
      state.provider !== AuthProvider.LOCAL ||
      state.passwordHash === null ||
      state.passwordHash === ''
    ) {
      throw new BadRequestException('Password change is available only for local accounts');
    }

    const matches = await argon2.verify(state.passwordHash, oldPassword);
    if (!matches) {
      throw new UnauthorizedException('Old password is invalid');
    }

    const hash = await argon2.hash(newPassword);
    await this.repository.updatePassword(userId, hash);
    await this.tokenService.revokeAllForUser(userId);
  }

  async deleteProfile(userId: string): Promise<void> {
    const existing = await this.repository.findActiveProfileByUserId(userId);
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    await this.repository.softDeleteUser(userId);
    await this.tokenService.revokeAllForUser(userId);
  }
}
