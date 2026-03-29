import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';

import { PrismaService } from '@/database/prisma.service';

import type { ProfileResult, UpdateProfileInput, UserPasswordState } from '../profile.types';

@Injectable()
export class ProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveProfileByUserId(userId: string): Promise<ProfileResult | null> {
    return this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        phone: true,
        emailVerified: true,
      },
    });
  }

  async updateProfile(userId: string, data: UpdateProfileInput): Promise<ProfileResult> {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        phone: true,
        emailVerified: true,
      },
    });
  }

  async findUserPasswordState(userId: string): Promise<UserPasswordState | null> {
    return this.prisma.user.findFirst({
      where: { id: userId },
      select: {
        id: true,
        provider: true,
        passwordHash: true,
        deletedAt: true,
      },
    });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async softDeleteUser(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
  }
}
