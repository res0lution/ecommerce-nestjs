/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access -- legacy passport-yandex */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';

const YandexStrategy = require('passport-yandex').Strategy as new (
  options: Record<string, string>,
  verify: (...args: unknown[]) => void,
) => unknown;

export interface YandexProfile {
  providerId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
}

@Injectable()
export class YandexPassportStrategy extends PassportStrategy(YandexStrategy, 'yandex') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('yandex.clientId', ''),
      clientSecret: config.get<string>('yandex.clientSecret', ''),
      callbackURL: config.get<string>('yandex.callbackUrl', ''),
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: {
      id: string;
      displayName?: string;
      emails?: { value: string }[];
      photos?: { value: string }[];
    },
    done: (err: Error | null, user?: YandexProfile) => void,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (email === undefined || email === '') {
      done(new Error('No email from Yandex'));
      return;
    }
    done(null, {
      providerId: profile.id,
      email,
      name: profile.displayName ?? null,
      avatarUrl: profile.photos?.[0]?.value ?? null,
      emailVerified: true,
    });
  }
}
