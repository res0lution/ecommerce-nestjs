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
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthProvider } from '@prisma/client';
import type { Request, Response } from 'express';

import { AUTH_COOKIE_PATH } from './auth.constants';
import { AuthService } from './auth.service';
import type {
  AuthTokensResult,
  MessageResult,
  OAuthUserProfile,
  OkResult,
  RefreshResult,
} from './auth.types';
import { cookieOpts } from './auth.utils';
import {
  AuthTokensResponseDto,
  MessageResponseDto,
  OkResponseDto,
  RefreshResponseDto,
} from './dto/auth-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@ApiTags('auth')
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
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered', type: AuthTokensResponseDto })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensResult> {
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
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthTokensResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Email not verified' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensResult> {
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
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  @ApiResponse({ status: 200, description: 'New access token', type: RefreshResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid refresh token' })
  async refresh(@Req() req: Request): Promise<RefreshResult> {
    const cookies = req.cookies as Record<string, string> | undefined;
    const raw = cookies?.[this.refreshCookieName()];
    return this.auth.refresh(raw);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out', type: OkResponseDto })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<OkResult> {
    const cookies = req.cookies as Record<string, string> | undefined;
    const raw = cookies?.[this.refreshCookieName()];
    await this.auth.logout(raw);
    res.clearCookie(this.refreshCookieName(), {
      path: AUTH_COOKIE_PATH,
      httpOnly: true,
      secure: this.config.get<string>('nodeEnv') === 'production',
      sameSite: 'strict',
    });
    return { ok: true };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with token from verification email' })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({ status: 200, description: 'Email verified', type: OkResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<OkResult> {
    await this.auth.verifyEmail(dto.token);
    return { ok: true };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Reset email sent if account exists',
    type: MessageResponseDto,
  })
  async forgot(@Body() dto: ForgotPasswordDto): Promise<MessageResult> {
    await this.auth.forgotPassword(dto.email);
    return {
      message: 'If the email exists, a reset link was sent',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token from email' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset', type: OkResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async reset(@Body() dto: ResetPasswordDto): Promise<OkResult> {
    await this.auth.resetPassword(dto.token, dto.password);
    return { ok: true };
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Redirect to Google OAuth' })
  @ApiResponse({ status: 302, description: 'Redirect to Google consent' })
  googleAuth(): void {
    return;
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback (redirects to frontend with accessToken)' })
  @ApiResponse({ status: 302, description: 'Redirect to frontend /auth/callback' })
  async googleCallback(
    @Req() req: Request & { user: OAuthUserProfile },
    @Res() res: Response,
  ): Promise<void> {
    const u = req.user;
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
  @ApiOperation({ summary: 'Redirect to Yandex OAuth' })
  @ApiResponse({ status: 302, description: 'Redirect to Yandex consent' })
  yandexAuth(): void {
    return;
  }

  @Get('yandex/callback')
  @UseGuards(AuthGuard('yandex'))
  @ApiOperation({ summary: 'Yandex OAuth callback (redirects to frontend with accessToken)' })
  @ApiResponse({ status: 302, description: 'Redirect to frontend /auth/callback' })
  async yandexCallback(
    @Req() req: Request & { user: OAuthUserProfile },
    @Res() res: Response,
  ): Promise<void> {
    const u = req.user;
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
