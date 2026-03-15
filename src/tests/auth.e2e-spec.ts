/* eslint-disable @typescript-eslint/no-unsafe-member-access -- supertest response typing */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- supertest */
import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common/interfaces';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthProvider } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from '../modules/auth/auth.service';
import { EmailService } from '../modules/notifications/email.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService | undefined;
  const email = `e2e-${Date.now()}@test.com`;
  const password = 'password123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma !== undefined) {
      await prisma.refreshToken.deleteMany({
        where: { user: { email: { startsWith: 'e2e-' } } },
      });
      await prisma.authToken.deleteMany({
        where: { user: { email: { startsWith: 'e2e-' } } },
      });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-' } } });
      await prisma.user.deleteMany({
        where: { email: { startsWith: 'oauth-e2e-' } },
      });
    }
    await app.close();
  });

  it('register returns user, accessToken, refresh cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'E2E User', email, password })
      .expect(201);

    expect(res.body.user.email).toBe(email);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('refreshToken')]),
    );
  });

  it('login fails before email verified', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(403);
  });

  it('verify-email then login succeeds', async () => {
    const emailService = app.get(EmailService);
    const token = emailService.lastVerificationToken;
    expect(token).toBeTruthy();

    await request(app.getHttpServer()).post('/api/auth/verify-email').send({ token }).expect(200);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    expect(login.body.accessToken).toBeDefined();
    const cookie = login.headers['set-cookie'] as unknown as string[];
    expect(cookie?.some((c) => c.includes('refreshToken'))).toBe(true);
  });

  it('refresh returns new accessToken with cookie', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    const cookies = login.headers['set-cookie'] as unknown as string[];
    const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');

    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookieHeader)
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(typeof res.body.accessToken).toBe('string');
  });

  it('logout clears session', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    const cookies = login.headers['set-cookie'] as unknown as string[];
    const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookieHeader)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookieHeader)
      .expect(401);
  });

  it('OAuth login via AuthService issues tokens', async () => {
    const auth = app.get(AuthService);
    const oauthEmail = `oauth-e2e-${Date.now()}@test.com`;
    const result = await auth.findOrCreateOAuthUser(
      AuthProvider.GOOGLE,
      `google-sub-${Date.now()}`,
      oauthEmail,
      'OAuth User',
      null,
      true,
    );
    expect(result.user.email).toBe(oauthEmail);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });
});
