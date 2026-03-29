import type { AuthProvider } from '@prisma/client';

import type { ProfileEntity } from './entities/profile.entity';

export type ProfileResult = ProfileEntity;

export interface UpdateProfileInput {
  name?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface UserPasswordState {
  id: string;
  provider: AuthProvider;
  passwordHash: string | null;
  deletedAt: Date | null;
}
