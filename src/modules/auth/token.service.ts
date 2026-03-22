import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';

import type { AccessPayload, AuthUserShape } from './auth.types';
import { AuthRepository } from './repository/auth.repository';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly repo: AuthRepository,
    private readonly config: ConfigService,
  ) {}

  hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  generateOpaqueToken(): string {
    return randomBytes(32).toString('hex');
  }

  signAccess(user: { id: string; email: string }): string {
    const payload: AccessPayload = {
      sub: user.id,
      email: user.email,
      role: 'USER',
    };
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: 900,
    });
  }

  async createRefreshSession(
    userId: string,
    meta: { device?: string; ip?: string },
  ): Promise<{ rawToken: string; expiresAt: Date }> {
    const raw = this.generateOpaqueToken();
    const tokenHash = this.hashToken(raw);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.repo.createRefreshToken({
      userId,
      tokenHash,
      expiresAt,
      device: meta.device ?? null,
      ip: meta.ip ?? null,
    });

    return { rawToken: raw, expiresAt };
  }

  async validateRefresh(raw: string): Promise<AuthUserShape> {
    const tokenHash = this.hashToken(raw);
    const row = await this.repo.findRefreshTokenWithUser(tokenHash);
    if (!row) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return row.user;
  }

  async revokeRefreshByRaw(raw: string): Promise<void> {
    const tokenHash = this.hashToken(raw);
    await this.repo.deleteRefreshTokensByHash(tokenHash);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.repo.deleteRefreshTokensByUserId(userId);
  }
}
