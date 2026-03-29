import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthProvider } from '@prisma/client';
import * as argon2 from 'argon2';

import { TokenService } from '../auth/token.service';
import { ProfileService } from './profile.service';
import { ProfileRepository } from './repository/profile.repository';

jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

type RepositoryMock = Pick<
  ProfileRepository,
  | 'findActiveProfileByUserId'
  | 'updateProfile'
  | 'findUserPasswordState'
  | 'updatePassword'
  | 'softDeleteUser'
>;

type TokenServiceMock = Pick<TokenService, 'revokeAllForUser'>;

describe('ProfileService', () => {
  let service: ProfileService;
  let repository: jest.Mocked<RepositoryMock>;
  let tokenService: jest.Mocked<TokenServiceMock>;

  beforeEach(() => {
    repository = {
      findActiveProfileByUserId: jest.fn(),
      updateProfile: jest.fn(),
      findUserPasswordState: jest.fn(),
      updatePassword: jest.fn(),
      softDeleteUser: jest.fn(),
    };
    tokenService = {
      revokeAllForUser: jest.fn(),
    };
    service = new ProfileService(
      repository as unknown as ProfileRepository,
      tokenService as unknown as TokenService,
    );
  });

  it('updates profile data for active user', async () => {
    repository.findActiveProfileByUserId.mockResolvedValue({
      id: 'u1',
      email: 'john@example.com',
      name: 'John',
      avatarUrl: null,
      phone: null,
      emailVerified: true,
    });
    repository.updateProfile.mockResolvedValue({
      id: 'u1',
      email: 'john@example.com',
      name: 'Johnny',
      avatarUrl: 'https://example.com/a.jpg',
      phone: '+123',
      emailVerified: true,
    });

    const result = await service.updateProfile('u1', {
      name: 'Johnny',
      phone: '+123',
      avatarUrl: 'https://example.com/a.jpg',
    });

    expect(result.name).toBe('Johnny');
    expect(repository.updateProfile).toHaveBeenCalledWith('u1', {
      name: 'Johnny',
      phone: '+123',
      avatarUrl: 'https://example.com/a.jpg',
    });
  });

  it('getProfile returns active user profile', async () => {
    repository.findActiveProfileByUserId.mockResolvedValue({
      id: 'u1',
      email: 'john@example.com',
      name: 'John',
      avatarUrl: null,
      phone: null,
      emailVerified: true,
    });

    const result = await service.getProfile('u1');

    expect(result.email).toBe('john@example.com');
    expect(repository.findActiveProfileByUserId).toHaveBeenCalledWith('u1');
  });

  it('updateProfile throws when profile is missing', async () => {
    repository.findActiveProfileByUserId.mockResolvedValue(null);

    await expect(service.updateProfile('u1', { name: 'Any' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('changePassword verifies old password and revokes refresh sessions', async () => {
    repository.findUserPasswordState.mockResolvedValue({
      id: 'u1',
      provider: AuthProvider.LOCAL,
      passwordHash: 'old-hash',
      deletedAt: null,
    });
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    (argon2.hash as jest.Mock).mockResolvedValue('new-hash');

    await service.changePassword('u1', 'oldPass', 'newPass123');

    expect(repository.updatePassword).toHaveBeenCalledWith('u1', 'new-hash');
    expect(tokenService.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('changePassword throws for oauth accounts', async () => {
    repository.findUserPasswordState.mockResolvedValue({
      id: 'u1',
      provider: AuthProvider.GOOGLE,
      passwordHash: null,
      deletedAt: null,
    });

    await expect(service.changePassword('u1', 'old', 'newPass123')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('changePassword throws when user is missing', async () => {
    repository.findUserPasswordState.mockResolvedValue(null);

    await expect(service.changePassword('u1', 'old', 'newPass123')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('changePassword throws when user is soft-deleted', async () => {
    repository.findUserPasswordState.mockResolvedValue({
      id: 'u1',
      provider: AuthProvider.LOCAL,
      passwordHash: 'hash',
      deletedAt: new Date(),
    });

    await expect(service.changePassword('u1', 'old', 'newPass123')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('changePassword throws when local account has no password hash', async () => {
    repository.findUserPasswordState.mockResolvedValue({
      id: 'u1',
      provider: AuthProvider.LOCAL,
      passwordHash: '',
      deletedAt: null,
    });

    await expect(service.changePassword('u1', 'old', 'newPass123')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('changePassword throws when old password does not match', async () => {
    repository.findUserPasswordState.mockResolvedValue({
      id: 'u1',
      provider: AuthProvider.LOCAL,
      passwordHash: 'old-hash',
      deletedAt: null,
    });
    (argon2.verify as jest.Mock).mockResolvedValue(false);

    await expect(service.changePassword('u1', 'wrong', 'newPass123')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('deleteProfile soft deletes user and revokes tokens', async () => {
    repository.findActiveProfileByUserId.mockResolvedValue({
      id: 'u1',
      email: 'john@example.com',
      name: 'John',
      avatarUrl: null,
      phone: null,
      emailVerified: true,
    });

    await service.deleteProfile('u1');

    expect(repository.softDeleteUser).toHaveBeenCalledWith('u1');
    expect(tokenService.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('throws when profile is missing', async () => {
    repository.findActiveProfileByUserId.mockResolvedValue(null);

    await expect(service.getProfile('u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deleteProfile throws when profile is missing', async () => {
    repository.findActiveProfileByUserId.mockResolvedValue(null);

    await expect(service.deleteProfile('u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
