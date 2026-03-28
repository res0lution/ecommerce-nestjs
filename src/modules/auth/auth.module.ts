import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { PrismaModule } from '../../database/prisma.module';
import { AuthEmailQueueModule } from '../../queues/auth-email-queue.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './repository/auth.repository';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { YandexPassportStrategy } from './strategies/yandex.strategy';
import { TokenService } from './token.service';

@Module({
  imports: [
    PrismaModule,
    AuthEmailQueueModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.accessSecret'),
        signOptions: { expiresIn: 900 },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    AuthService,
    TokenService,
    JwtStrategy,
    GoogleStrategy,
    YandexPassportStrategy,
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
