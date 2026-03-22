import type { AuthProvider } from '@prisma/client';

export interface AccessPayload {
  sub: string;
  email: string;
  role: 'USER';
}

export interface AuthUserShape {
  id: string;
  email: string;
  name: string | null;
  provider: AuthProvider;
  emailVerified: boolean;
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
