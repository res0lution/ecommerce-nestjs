import type { ConfigService } from '@nestjs/config';

import { AUTH_COOKIE_PATH, REFRESH_COOKIE_MAX_AGE_MS } from './auth.constants';
import type { CookieOptions } from './auth.types';

export function cookieOpts(config: ConfigService): CookieOptions {
  return {
    httpOnly: true,
    secure: config.get<string>('nodeEnv') === 'production',
    sameSite: 'strict',
    path: AUTH_COOKIE_PATH,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  };
}
