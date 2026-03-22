import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthProvider, AuthTokenType } from '@prisma/client';
import * as argon2 from 'argon2';

import { EmailService } from '../notifications/email.service';
import { RESET_TTL_MS, VERIFY_TTL_MS } from './auth.constants';
import type { AuthTokensResult, RefreshResult } from './auth.types';
import { AuthRepository } from './repository/auth.repository';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly repo: AuthRepository,
    private readonly tokens: TokenService,
    private readonly email: EmailService,
  ) {}

  async register(
    name: string,
    email: string,
    password: string,
    meta: { device?: string; ip?: string },
  ): Promise<AuthTokensResult> {
    const existing = await this.repo.findUserByEmail(email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await argon2.hash(password);
    const user = await this.repo.createLocalUser({ email, name, passwordHash });

    const rawVerify = this.tokens.generateOpaqueToken();
    const verifyHash = this.tokens.hashToken(rawVerify);
    const verifyExpires = new Date(Date.now() + VERIFY_TTL_MS);
    await this.repo.deleteAuthTokensByUserAndType(user.id, AuthTokenType.VERIFY_EMAIL);
    await this.repo.createAuthToken({
      userId: user.id,
      type: AuthTokenType.VERIFY_EMAIL,
      tokenHash: verifyHash,
      expiresAt: verifyExpires,
    });

    try {
      await this.email.sendVerificationEmail(email, rawVerify);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Verification email failed: ${msg}`);
    }

    const accessToken = this.tokens.signAccess(user);
    const { rawToken: refreshToken } = await this.tokens.createRefreshSession(user.id, meta);

    return {
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
      refreshToken,
    };
  }

  async login(
    email: string,
    password: string,
    meta: { device?: string; ip?: string },
  ): Promise<AuthTokensResult> {
    const user = await this.repo.findUserByEmail(email);
    if (
      user === null ||
      user.provider !== AuthProvider.LOCAL ||
      user.passwordHash === null ||
      user.passwordHash === ''
    ) {
      this.logger.warn(`Login fail: unknown user ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      this.logger.warn(`Login fail: bad password ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified) {
      this.logger.warn(`Login fail: unverified ${email}`);
      throw new ForbiddenException('Email not verified');
    }

    this.logger.log(`Login success userId=${user.id} email=${email}`);

    const accessToken = this.tokens.signAccess(user);
    const { rawToken: refreshToken } = await this.tokens.createRefreshSession(user.id, meta);

    return {
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshRaw: string | undefined): Promise<RefreshResult> {
    if (refreshRaw === undefined || refreshRaw === '') {
      throw new UnauthorizedException('Missing refresh token');
    }
    const user = await this.tokens.validateRefresh(refreshRaw);
    return { accessToken: this.tokens.signAccess(user) };
  }

  async logout(refreshRaw: string | undefined): Promise<void> {
    if (refreshRaw !== undefined && refreshRaw !== '') {
      await this.tokens.revokeRefreshByRaw(refreshRaw);
    }
    this.logger.log('Logout');
  }

  async verifyEmail(token: string): Promise<void> {
    const hash = this.tokens.hashToken(token);
    const row = await this.repo.findValidAuthToken(AuthTokenType.VERIFY_EMAIL, hash);
    if (!row) {
      throw new BadRequestException('Invalid or expired token');
    }
    await this.repo.verifyEmailAndDeleteToken(row.userId, row.id);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.repo.findUserByEmail(email);
    if (!user || user.provider !== AuthProvider.LOCAL) {
      return;
    }
    const raw = this.tokens.generateOpaqueToken();
    const tokenHash = this.tokens.hashToken(raw);
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);
    await this.repo.deleteAuthTokensByUserAndType(user.id, AuthTokenType.RESET_PASSWORD);
    await this.repo.createAuthToken({
      userId: user.id,
      type: AuthTokenType.RESET_PASSWORD,
      tokenHash,
      expiresAt,
    });
    try {
      await this.email.sendPasswordResetEmail(email, raw);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Reset email failed: ${msg}`);
    }
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const hash = this.tokens.hashToken(token);
    const row = await this.repo.findValidAuthToken(AuthTokenType.RESET_PASSWORD, hash);
    if (!row) {
      throw new BadRequestException('Invalid or expired token');
    }
    const passwordHash = await argon2.hash(password);
    await this.repo.resetPasswordRevokeTokens(row.userId, passwordHash);
  }

  async findOrCreateOAuthUser(
    provider: AuthProvider,
    providerId: string,
    email: string,
    name: string | null,
    avatarUrl: string | null,
    emailVerified: boolean,
  ): Promise<AuthTokensResult> {
    let user = await this.repo.findUserByProvider(provider, providerId);
    if (user) {
      this.logger.log(`OAuth login provider=${provider} userId=${user.id}`);
      const accessToken = this.tokens.signAccess(user);
      const { rawToken: refreshToken } = await this.tokens.createRefreshSession(user.id, {});
      return {
        user: { id: user.id, email: user.email, name: user.name },
        accessToken,
        refreshToken,
      };
    }

    const byEmail = await this.repo.findUserByEmail(email);
    if (byEmail?.provider === AuthProvider.LOCAL) {
      throw new ConflictException('Email already registered with password');
    }
    if (byEmail) {
      throw new ConflictException('Email already linked to another provider');
    }

    user = await this.repo.createOAuthUser({
      email,
      name,
      avatarUrl,
      provider,
      providerId,
      emailVerified: emailVerified || true,
    });

    this.logger.log(`OAuth login provider=${provider} userId=${user.id}`);

    const accessToken = this.tokens.signAccess(user);
    const { rawToken: refreshToken } = await this.tokens.createRefreshSession(user.id, {});

    return {
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
      refreshToken,
    };
  }
}
