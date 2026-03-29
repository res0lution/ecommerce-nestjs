import type { AuthProvider, AuthTokenType, UserRole } from '@prisma/client';

export interface AccessPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthUserShape {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  provider: AuthProvider;
  emailVerified: boolean;
  deletedAt: Date | null;
}

export interface AuthUserPublic {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthTokensResult {
  user: AuthUserPublic;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResult {
  accessToken: string;
}

export interface OkResult {
  ok: true;
}

export interface MessageResult {
  message: string;
}

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict';
  path: string;
  maxAge: number;
}

export interface OAuthUserProfile {
  providerId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
}

export interface CreateLocalUserInput {
  email: string;
  name: string;
  passwordHash: string;
}

export interface CreateOAuthUserInput {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  provider: AuthProvider;
  providerId: string;
  emailVerified: boolean;
}

export interface CreateAuthTokenInput {
  userId: string;
  type: AuthTokenType;
  tokenHash: string;
  expiresAt: Date;
}

export interface CreateRefreshTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  device: string | null;
  ip: string | null;
}

export interface RefreshTokenWithUser {
  user: AuthUserShape;
}
