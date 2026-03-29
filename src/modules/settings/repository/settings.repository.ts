import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/database/prisma.service';

import type { SettingsResult, UpdateSettingsInput } from '../settings.types';

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<SettingsResult | null> {
    return this.prisma.userSettings.findUnique({
      where: { userId },
      select: {
        userId: true,
        language: true,
        currency: true,
        notificationsEnabled: true,
      },
    });
  }

  async createDefaultForUser(userId: string): Promise<SettingsResult> {
    return this.prisma.userSettings.create({
      data: { userId },
      select: {
        userId: true,
        language: true,
        currency: true,
        notificationsEnabled: true,
      },
    });
  }

  async updateForUser(userId: string, data: UpdateSettingsInput): Promise<SettingsResult> {
    return this.prisma.userSettings.update({
      where: { userId },
      data,
      select: {
        userId: true,
        language: true,
        currency: true,
        notificationsEnabled: true,
      },
    });
  }
}
