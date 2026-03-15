import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { AuthProvider } from '@prisma/client';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

function cookieOpts(config: ConfigService): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict';
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: config.get<string>('nodeEnv') === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private refreshCookieName(): string {
    return this.config.get<string>('auth.refreshCookieName', 'refreshToken');
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(dto.name, dto.email, dto.password, {
      device: req.headers['user-agent'],
      ip: req.ip,
    });
    res.cookie(this.refreshCookieName(), result.refreshToken, cookieOpts(this.config));
    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto.email, dto.password, {
      device: req.headers['user-agent'],
      ip: req.ip,
    });
    res.cookie(this.refreshCookieName(), result.refreshToken, cookieOpts(this.config));
    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const raw = cookies?.[this.refreshCookieName()];
    return this.auth.refresh(raw);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const raw = cookies?.[this.refreshCookieName()];
    await this.auth.logout(raw);
    res.clearCookie(this.refreshCookieName(), {
      path: '/api/auth',
      httpOnly: true,
      secure: this.config.get<string>('nodeEnv') === 'production',
      sameSite: 'strict',
    });
    return { ok: true };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.auth.verifyEmail(dto.token);
    return { ok: true };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgot(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    return {
      message: 'If the email exists, a reset link was sent',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async reset(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.password);
    return { ok: true };
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    return;
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: Request & { user: Record<string, unknown> },
    @Res() res: Response,
  ) {
    const u = req.user as {
      providerId: string;
      email: string;
      name: string | null;
      avatarUrl: string | null;
      emailVerified: boolean;
    };
    const result = await this.auth.findOrCreateOAuthUser(
      AuthProvider.GOOGLE,
      u.providerId,
      u.email,
      u.name,
      u.avatarUrl,
      u.emailVerified,
    );
    res.cookie(this.refreshCookieName(), result.refreshToken, cookieOpts(this.config));
    const front = this.config.get<string>('frontendUrl', '');
    res.redirect(`${front}/auth/callback?accessToken=${encodeURIComponent(result.accessToken)}`);
  }

  @Get('yandex')
  @UseGuards(AuthGuard('yandex'))
  yandexAuth() {
    return;
  }

  @Get('yandex/callback')
  @UseGuards(AuthGuard('yandex'))
  async yandexCallback(
    @Req() req: Request & { user: Record<string, unknown> },
    @Res() res: Response,
  ) {
    const u = req.user as {
      providerId: string;
      email: string;
      name: string | null;
      avatarUrl: string | null;
      emailVerified: boolean;
    };
    const result = await this.auth.findOrCreateOAuthUser(
      AuthProvider.YANDEX,
      u.providerId,
      u.email,
      u.name,
      u.avatarUrl,
      u.emailVerified,
    );
    res.cookie(this.refreshCookieName(), result.refreshToken, cookieOpts(this.config));
    const front = this.config.get<string>('frontendUrl', '');
    res.redirect(`${front}/auth/callback?accessToken=${encodeURIComponent(result.accessToken)}`);
  }
}
