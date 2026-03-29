import { NotFoundException } from '@nestjs/common';

import { ProfileRepository } from '../profile/repository/profile.repository';
import { SettingsRepository } from './repository/settings.repository';
import { SettingsService } from './settings.service';

type SettingsRepositoryMock = Pick<
  SettingsRepository,
  'findByUserId' | 'createDefaultForUser' | 'updateForUser'
>;
type ProfileRepositoryMock = Pick<ProfileRepository, 'findActiveProfileByUserId'>;

describe('SettingsService', () => {
  let service: SettingsService;
  let repository: jest.Mocked<SettingsRepositoryMock>;
  let profileRepository: jest.Mocked<ProfileRepositoryMock>;

  beforeEach(() => {
    repository = {
      findByUserId: jest.fn(),
      createDefaultForUser: jest.fn(),
      updateForUser: jest.fn(),
    };
    profileRepository = {
      findActiveProfileByUserId: jest.fn(),
    };

    service = new SettingsService(
      repository as unknown as SettingsRepository,
      profileRepository as unknown as ProfileRepository,
    );
  });

  it('getSettings returns existing settings when row exists', async () => {
    profileRepository.findActiveProfileByUserId.mockResolvedValue({
      id: 'u1',
      email: 'john@example.com',
      name: 'John',
      avatarUrl: null,
      phone: null,
      emailVerified: true,
    });
    repository.findByUserId.mockResolvedValue({
      userId: 'u1',
      language: 'en',
      currency: 'USD',
      notificationsEnabled: true,
    });

    const result = await service.getSettings('u1');

    expect(result.currency).toBe('USD');
    expect(repository.createDefaultForUser).not.toHaveBeenCalled();
  });

  it('getSettings creates defaults when settings are missing', async () => {
    profileRepository.findActiveProfileByUserId.mockResolvedValue({
      id: 'u1',
      email: 'john@example.com',
      name: 'John',
      avatarUrl: null,
      phone: null,
      emailVerified: true,
    });
    repository.findByUserId.mockResolvedValue(null);
    repository.createDefaultForUser.mockResolvedValue({
      userId: 'u1',
      language: 'en',
      currency: 'USD',
      notificationsEnabled: true,
    });

    const result = await service.getSettings('u1');

    expect(repository.createDefaultForUser).toHaveBeenCalledWith('u1');
    expect(result.language).toBe('en');
  });

  it('getSettings throws when profile is missing', async () => {
    profileRepository.findActiveProfileByUserId.mockResolvedValue(null);

    await expect(service.getSettings('u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateSettings updates existing settings', async () => {
    profileRepository.findActiveProfileByUserId.mockResolvedValue({
      id: 'u1',
      email: 'john@example.com',
      name: 'John',
      avatarUrl: null,
      phone: null,
      emailVerified: true,
    });
    repository.findByUserId.mockResolvedValue({
      userId: 'u1',
      language: 'en',
      currency: 'USD',
      notificationsEnabled: true,
    });
    repository.updateForUser.mockResolvedValue({
      userId: 'u1',
      language: 'de',
      currency: 'EUR',
      notificationsEnabled: false,
    });

    const result = await service.updateSettings('u1', {
      language: 'de',
      currency: 'EUR',
      notificationsEnabled: false,
    });

    expect(repository.createDefaultForUser).not.toHaveBeenCalled();
    expect(repository.updateForUser).toHaveBeenCalledWith('u1', {
      language: 'de',
      currency: 'EUR',
      notificationsEnabled: false,
    });
    expect(result.currency).toBe('EUR');
  });

  it('updateSettings creates defaults before update when settings are missing', async () => {
    profileRepository.findActiveProfileByUserId.mockResolvedValue({
      id: 'u1',
      email: 'john@example.com',
      name: 'John',
      avatarUrl: null,
      phone: null,
      emailVerified: true,
    });
    repository.findByUserId.mockResolvedValue(null);
    repository.createDefaultForUser.mockResolvedValue({
      userId: 'u1',
      language: 'en',
      currency: 'USD',
      notificationsEnabled: true,
    });
    repository.updateForUser.mockResolvedValue({
      userId: 'u1',
      language: 'fr',
      currency: 'EUR',
      notificationsEnabled: true,
    });

    const result = await service.updateSettings('u1', { language: 'fr' });

    expect(repository.createDefaultForUser).toHaveBeenCalledWith('u1');
    expect(repository.updateForUser).toHaveBeenCalledWith('u1', { language: 'fr' });
    expect(result.language).toBe('fr');
  });

  it('updateSettings throws when profile is missing', async () => {
    profileRepository.findActiveProfileByUserId.mockResolvedValue(null);

    await expect(service.updateSettings('u1', { language: 'ru' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
