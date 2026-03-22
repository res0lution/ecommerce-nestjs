import type { AuthProvider } from '@prisma/client';

/**
 * Domain entity for user in auth context (API responses and internal use).
 */
export interface UserEntity {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  provider: AuthProvider;
  emailVerified: boolean;
}
