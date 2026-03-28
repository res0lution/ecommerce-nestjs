import { UnauthorizedException } from '@nestjs/common';

import type { AccessPayload } from '../auth.types';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('returns payload when sub and email are present', () => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue('access-secret'),
    };
    const strategy = new JwtStrategy(config as never);
    const payload: AccessPayload = {
      sub: 'u1',
      email: 'john@example.com',
      role: 'USER',
    };

    expect(strategy.validate(payload)).toEqual(payload);
  });

  it('throws unauthorized when payload is malformed', () => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue('access-secret'),
    };
    const strategy = new JwtStrategy(config as never);
    const malformed = { sub: '', email: '', role: 'USER' } as AccessPayload;

    expect(() => strategy.validate(malformed)).toThrow(UnauthorizedException);
  });
});
