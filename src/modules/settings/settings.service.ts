import { Injectable, NotFoundException } from '@nestjs/common';

import { ProfileRepository } from '../profile/repository/profile.repository';
import { SettingsRepository } from './repository/settings.repository';
import type { SettingsResult, UpdateSettingsInput } from './settings.types';

@Injectable()
export class SettingsService {
  constructor(
    private readonly repository: SettingsRepository,
    private readonly profileRepository: ProfileRepository,
  ) {}

  async getSettings(userId: string): Promise<SettingsResult> {
    const profile = await this.profileRepository.findActiveProfileByUserId(userId);
    if (!profile) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.repository.findByUserId(userId);
    if (existing) {
      return existing;
    }
    return this.repository.createDefaultForUser(userId);
  }

  async updateSettings(userId: string, input: UpdateSettingsInput): Promise<SettingsResult> {
    const profile = await this.profileRepository.findActiveProfileByUserId(userId);
    if (!profile) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.repository.findByUserId(userId);
    if (!existing) {
      await this.repository.createDefaultForUser(userId);
    }
    return this.repository.updateForUser(userId, input);
  }
}
