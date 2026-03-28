import { UnauthorizedException } from '@nestjs/common';

import { TokenService } from './token.service';

type JwtMock = {
  sign: jest.Mock;
};

type RepoMock = {
  createRefreshToken: jest.Mock;
  findRefreshTokenWithUser: jest.Mock;
  deleteRefreshTokensByHash: jest.Mock;
  deleteRefreshTokensByUserId: jest.Mock;
};

type ConfigMock = {
  getOrThrow: jest.Mock;
};

describe('TokenService', () => {
  let service: TokenService;
  let jwt: JwtMock;
  let repo: RepoMock;
  let config: ConfigMock;

  beforeEach(() => {
    jwt = {
      sign: jest.fn(),
    };
    repo = {
      createRefreshToken: jest.fn(),
      findRefreshTokenWithUser: jest.fn(),
      deleteRefreshTokensByHash: jest.fn(),
      deleteRefreshTokensByUserId: jest.fn(),
    };
    config = {
      getOrThrow: jest.fn().mockReturnValue('access-secret'),
    };
    service = new TokenService(jwt as never, repo as never, config as never);
  });

  it('hashToken is deterministic and returns sha256 hex', () => {
    const a = service.hashToken('raw-token');
    const b = service.hashToken('raw-token');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('signAccess signs payload with configured secret', () => {
    jwt.sign.mockReturnValue('jwt-token');

    const token = service.signAccess({ id: 'u1', email: 'john@example.com' });

    expect(jwt.sign).toHaveBeenCalledWith(
      { sub: 'u1', email: 'john@example.com', role: 'USER' },
      { secret: 'access-secret', expiresIn: 900 },
    );
    expect(token).toBe('jwt-token');
  });

  it('createRefreshSession persists hashed token and returns raw token', async () => {
    jest.spyOn(service, 'generateOpaqueToken').mockReturnValue('raw-refresh');

    const result = await service.createRefreshSession('u1', {
      device: 'Chrome',
      ip: '127.0.0.1',
    });

    expect(result.rawToken).toBe('raw-refresh');
    expect(repo.createRefreshToken).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(repo.createRefreshToken.mock.calls[0][0]).toMatchObject({
      userId: 'u1',
      device: 'Chrome',
      ip: '127.0.0.1',
    });
  });

  it('validateRefresh throws when token not found', async () => {
    repo.findRefreshTokenWithUser.mockResolvedValue(null);

    await expect(service.validateRefresh('unknown')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('validateRefresh returns user when token exists', async () => {
    repo.findRefreshTokenWithUser.mockResolvedValue({
      user: {
        id: 'u1',
        email: 'john@example.com',
        name: 'John',
        provider: 'LOCAL',
        emailVerified: true,
      },
    });

    const user = await service.validateRefresh('raw');

    expect(user.email).toBe('john@example.com');
  });

  it('revokeRefreshByRaw deletes hash from repository', async () => {
    await service.revokeRefreshByRaw('raw');

    expect(repo.deleteRefreshTokensByHash).toHaveBeenCalledTimes(1);
  });

  it('revokeAllForUser deletes all refresh tokens for user', async () => {
    await service.revokeAllForUser('u1');

    expect(repo.deleteRefreshTokensByUserId).toHaveBeenCalledWith('u1');
  });
});
