import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthProvider, AuthTokenType } from '@prisma/client';
import * as argon2 from 'argon2';

import { AuthEmailProducer } from '../../queues/auth-email.producer';
import { AuthService } from './auth.service';
import { AuthRepository } from './repository/auth.repository';
import { TokenService } from './token.service';

jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

type RepoMock = Pick<
  AuthRepository,
  | 'findUserByEmail'
  | 'createLocalUser'
  | 'deleteAuthTokensByUserAndType'
  | 'createAuthToken'
  | 'findValidAuthToken'
  | 'verifyEmailAndDeleteToken'
  | 'resetPasswordRevokeTokens'
  | 'findUserByProvider'
  | 'createOAuthUser'
>;

type TokenMock = Pick<
  TokenService,
  | 'generateOpaqueToken'
  | 'hashToken'
  | 'signAccess'
  | 'createRefreshSession'
  | 'validateRefresh'
  | 'revokeRefreshByRaw'
>;

type EmailProducerMock = Pick<
  AuthEmailProducer,
  'enqueueVerificationEmail' | 'enqueuePasswordResetEmail'
>;

describe('AuthService', () => {
  let service: AuthService;
  let repo: jest.Mocked<RepoMock>;
  let tokens: jest.Mocked<TokenMock>;
  let authEmailProducer: jest.Mocked<EmailProducerMock>;

  beforeEach(() => {
    repo = {
      findUserByEmail: jest.fn(),
      createLocalUser: jest.fn(),
      deleteAuthTokensByUserAndType: jest.fn(),
      createAuthToken: jest.fn(),
      findValidAuthToken: jest.fn(),
      verifyEmailAndDeleteToken: jest.fn(),
      resetPasswordRevokeTokens: jest.fn(),
      findUserByProvider: jest.fn(),
      createOAuthUser: jest.fn(),
    };
    tokens = {
      generateOpaqueToken: jest.fn(),
      hashToken: jest.fn(),
      signAccess: jest.fn(),
      createRefreshSession: jest.fn(),
      validateRefresh: jest.fn(),
      revokeRefreshByRaw: jest.fn(),
    };
    authEmailProducer = {
      enqueueVerificationEmail: jest.fn(),
      enqueuePasswordResetEmail: jest.fn(),
    };
    service = new AuthService(
      repo as unknown as AuthRepository,
      tokens as unknown as TokenService,
      authEmailProducer as unknown as AuthEmailProducer,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('register throws when email already exists', async () => {
    repo.findUserByEmail.mockResolvedValue({
      id: 'u1',
      email: 'john@example.com',
    } as never);

    await expect(
      service.register('John', 'john@example.com', 'password123', {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('register creates user, verification token and auth tokens', async () => {
    repo.findUserByEmail.mockResolvedValue(null);
    (argon2.hash as jest.Mock).mockResolvedValue('pwd-hash');
    repo.createLocalUser.mockResolvedValue({
      id: 'u1',
      email: 'john@example.com',
      name: 'John',
    } as never);
    tokens.generateOpaqueToken.mockReturnValue('verify-raw');
    tokens.hashToken.mockReturnValue('verify-hash');
    tokens.signAccess.mockReturnValue('access');
    tokens.createRefreshSession.mockResolvedValue({
      rawToken: 'refresh',
      expiresAt: new Date(),
    });

    const result = await service.register('John', 'john@example.com', 'password123', {
      device: 'test',
      ip: '127.0.0.1',
    });

    expect(repo.deleteAuthTokensByUserAndType).toHaveBeenCalledWith(
      'u1',
      AuthTokenType.VERIFY_EMAIL,
    );
    expect(repo.createAuthToken).toHaveBeenCalledTimes(1);
    expect(authEmailProducer.enqueueVerificationEmail).toHaveBeenCalledWith(
      'john@example.com',
      'verify-raw',
    );
    expect(result).toEqual({
      user: { id: 'u1', email: 'john@example.com', name: 'John' },
      accessToken: 'access',
      refreshToken: 'refresh',
    });
  });

  it('login throws unauthorized for invalid password', async () => {
    repo.findUserByEmail.mockResolvedValue({
      id: 'u1',
      email: 'john@example.com',
      name: 'John',
      role: 'USER',
      provider: AuthProvider.LOCAL,
      passwordHash: 'hash',
      emailVerified: true,
      deletedAt: null,
    } as never);
    (argon2.verify as jest.Mock).mockResolvedValue(false);

    await expect(service.login('john@example.com', 'bad-pass', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('login throws forbidden when email is not verified', async () => {
    repo.findUserByEmail.mockResolvedValue({
      id: 'u1',
      email: 'john@example.com',
      name: 'John',
      role: 'USER',
      provider: AuthProvider.LOCAL,
      passwordHash: 'hash',
      emailVerified: false,
      deletedAt: null,
    } as never);
    (argon2.verify as jest.Mock).mockResolvedValue(true);

    await expect(service.login('john@example.com', 'password123', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refresh throws when refresh token is missing', async () => {
    await expect(service.refresh(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logout revokes only when token is present', async () => {
    await service.logout(undefined);
    expect(tokens.revokeRefreshByRaw).not.toHaveBeenCalled();

    await service.logout('refresh-raw');
    expect(tokens.revokeRefreshByRaw).toHaveBeenCalledWith('refresh-raw');
  });

  it('verifyEmail throws when token is invalid', async () => {
    tokens.hashToken.mockReturnValue('verify-hash');
    repo.findValidAuthToken.mockResolvedValue(null);

    await expect(service.verifyEmail('raw')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forgotPassword creates reset token for local user', async () => {
    repo.findUserByEmail.mockResolvedValue({
      id: 'u1',
      email: 'john@example.com',
      role: 'USER',
      provider: AuthProvider.LOCAL,
      deletedAt: null,
    } as never);
    tokens.generateOpaqueToken.mockReturnValue('reset-raw');
    tokens.hashToken.mockReturnValue('reset-hash');

    await service.forgotPassword('john@example.com');

    expect(repo.deleteAuthTokensByUserAndType).toHaveBeenCalledWith(
      'u1',
      AuthTokenType.RESET_PASSWORD,
    );
    expect(repo.createAuthToken).toHaveBeenCalledTimes(1);
    expect(authEmailProducer.enqueuePasswordResetEmail).toHaveBeenCalledWith(
      'john@example.com',
      'reset-raw',
    );
  });

  it('resetPassword hashes and updates password by valid token', async () => {
    tokens.hashToken.mockReturnValue('reset-hash');
    repo.findValidAuthToken.mockResolvedValue({
      id: 'token-id',
      userId: 'u1',
    } as never);
    (argon2.hash as jest.Mock).mockResolvedValue('new-password-hash');

    await service.resetPassword('raw-token', 'new-password');

    expect(repo.resetPasswordRevokeTokens).toHaveBeenCalledWith('u1', 'new-password-hash');
  });

  it('findOrCreateOAuthUser throws when email is already local', async () => {
    repo.findUserByProvider.mockResolvedValue(null);
    repo.findUserByEmail.mockResolvedValue({
      id: 'u1',
      role: 'USER',
      provider: AuthProvider.LOCAL,
      deletedAt: null,
    } as never);

    await expect(
      service.findOrCreateOAuthUser(
        AuthProvider.GOOGLE,
        'google-sub',
        'john@example.com',
        'John',
        null,
        true,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('findOrCreateOAuthUser creates new oauth user and returns tokens', async () => {
    repo.findUserByProvider.mockResolvedValue(null);
    repo.findUserByEmail.mockResolvedValue(null);
    repo.createOAuthUser.mockResolvedValue({
      id: 'u2',
      email: 'oauth@example.com',
      name: 'OAuth',
    } as never);
    tokens.signAccess.mockReturnValue('access');
    tokens.createRefreshSession.mockResolvedValue({
      rawToken: 'refresh',
      expiresAt: new Date(),
    });

    const result = await service.findOrCreateOAuthUser(
      AuthProvider.GOOGLE,
      'google-sub',
      'oauth@example.com',
      'OAuth',
      null,
      true,
    );

    expect(repo.createOAuthUser).toHaveBeenCalledTimes(1);
    expect(result.accessToken).toBe('access');
    expect(result.refreshToken).toBe('refresh');
  });
});
