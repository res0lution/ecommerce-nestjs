import { Injectable } from '@nestjs/common';
import {
  AuthProvider,
  type AuthToken,
  AuthTokenType,
  type RefreshToken,
  type User,
} from '@prisma/client';

import { PrismaService } from '@/database/prisma.service';

import type {
  CreateAuthTokenInput,
  CreateLocalUserInput,
  CreateOAuthUserInput,
  CreateRefreshTokenInput,
  RefreshTokenWithUser,
} from '../auth.types';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findUserByProvider(provider: AuthProvider, providerId: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { provider, providerId },
    });
  }

  async createLocalUser(data: CreateLocalUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        ...data,
        provider: AuthProvider.LOCAL,
        emailVerified: false,
      },
    });
  }

  async createOAuthUser(data: CreateOAuthUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        ...data,
        emailVerified: data.emailVerified ?? true,
      },
    });
  }

  async updateUserEmailVerified(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async createAuthToken(data: CreateAuthTokenInput): Promise<AuthToken> {
    return this.prisma.authToken.create({ data });
  }

  async deleteAuthTokensByUserAndType(userId: string, type: AuthTokenType): Promise<void> {
    await this.prisma.authToken.deleteMany({
      where: { userId, type },
    });
  }

  async findValidAuthToken(type: AuthTokenType, tokenHash: string): Promise<AuthToken | null> {
    return this.prisma.authToken.findFirst({
      where: {
        type,
        tokenHash,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async deleteAuthToken(id: string): Promise<void> {
    await this.prisma.authToken.delete({ where: { id } });
  }

  async deleteAuthTokensByUserIdAndType(userId: string, type: AuthTokenType): Promise<void> {
    await this.prisma.authToken.deleteMany({
      where: { userId, type },
    });
  }

  async verifyEmailAndDeleteToken(userId: string, tokenId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      }),
      this.prisma.authToken.delete({ where: { id: tokenId } }),
    ]);
  }

  async resetPasswordRevokeTokens(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.authToken.deleteMany({
        where: { userId, type: AuthTokenType.RESET_PASSWORD },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);
  }

  async createRefreshToken(data: CreateRefreshTokenInput): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  async findRefreshTokenWithUser(tokenHash: string): Promise<RefreshTokenWithUser | null> {
    const row = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            provider: true,
            emailVerified: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!row) return null;
    return { user: row.user };
  }

  async deleteRefreshTokensByHash(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
  }

  async deleteRefreshTokensByUserId(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
