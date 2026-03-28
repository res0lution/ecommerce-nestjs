/* eslint-disable @typescript-eslint/no-unsafe-member-access -- supertest response typing */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- supertest */
import { getQueueToken } from '@nestjs/bullmq';
import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common/interfaces';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthProvider } from '@prisma/client';
import { Queue } from 'bullmq';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from '../modules/auth/auth.service';
import { AuthEmailProducer } from '../queues/auth-email.producer';
import { AUTH_EMAIL_QUEUE } from '../queues/queue.constants';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService | undefined;
  let verifiedCookieHeader = '';
  const email = `e2e-${Date.now()}@test.com`;
  const password = 'password123';
  const nextPassword = 'password456';

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
    const httpAdapter = app.getHttpAdapter().getInstance() as {
      set: (name: string, value: unknown) => void;
    };
    httpAdapter.set('trust proxy', true);
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
      await prisma.$disconnect();
    }

    const authEmailQueue = app.get<Queue>(getQueueToken(AUTH_EMAIL_QUEUE), { strict: false });
    await authEmailQueue.close();
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

  it('register duplicate email returns 409', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'E2E User', email, password })
      .expect(409);
  });

  it('register validates DTO payload', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'A', email: 'not-email', password: 'short' })
      .expect(400);
  });

  it('login with wrong password returns 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-forwarded-for', '10.0.0.1')
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  it('login fails before email verified', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-forwarded-for', '10.0.0.2')
      .send({ email, password })
      .expect(403);
  });

  it('verify-email invalid token returns 400', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/verify-email')
      .send({ token: 'bad-token' })
      .expect(400);
  });

  it('verify-email then login succeeds', async () => {
    const authEmailProducer = app.get(AuthEmailProducer);
    const token = authEmailProducer.lastVerificationToken;
    expect(token).toBeTruthy();

    await request(app.getHttpServer()).post('/api/auth/verify-email').send({ token }).expect(200);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-forwarded-for', '10.0.0.3')
      .send({ email, password })
      .expect(200);

    expect(login.body.accessToken).toBeDefined();
    const cookie = login.headers['set-cookie'] as unknown as string[];
    expect(cookie?.some((c) => c.includes('refreshToken'))).toBe(true);
    verifiedCookieHeader = cookie.map((c) => c.split(';')[0]).join('; ');
  });

  it('refresh without cookie returns 401', async () => {
    await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
  });

  it('refresh returns new accessToken with cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', verifiedCookieHeader)
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(typeof res.body.accessToken).toBe('string');
  });

  it('logout clears session', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', verifiedCookieHeader)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', verifiedCookieHeader)
      .expect(401);
  });

  it('forgot-password always returns generic message', async () => {
    const existing = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email })
      .expect(200);
    expect(existing.body.message).toBe('If the email exists, a reset link was sent');

    const unknown = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: `missing-${Date.now()}@test.com` })
      .expect(200);
    expect(unknown.body.message).toBe('If the email exists, a reset link was sent');
  });

  it('reset-password invalid token returns 400', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token: 'invalid-token', password: nextPassword })
      .expect(400);
  });

  it('forgot + reset changes password and old password fails', async () => {
    const authEmailProducer = app.get(AuthEmailProducer);
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email })
      .expect(200);
    const token = authEmailProducer.lastResetToken;
    expect(token).toBeTruthy();

    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token, password: nextPassword })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-forwarded-for', '10.0.0.4')
      .send({ email, password })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-forwarded-for', '10.0.0.5')
      .send({ email, password: nextPassword })
      .expect(200);
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
