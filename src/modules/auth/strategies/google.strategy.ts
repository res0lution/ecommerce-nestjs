import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('google.clientId', ''),
      clientSecret: config.get<string>('google.clientSecret', ''),
      callbackURL: config.get<string>('google.callbackUrl', ''),
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const { id, displayName, emails, photos } = profile;
    const email = emails?.[0]?.value;
    if (email === undefined || email === '') {
      done(new Error('No email from Google'), undefined);
      return;
    }
    done(null, {
      providerId: id,
      email,
      name: displayName ?? null,
      avatarUrl: photos?.[0]?.value ?? null,
      emailVerified: emails?.[0]?.verified ?? true,
    });
  }
}
