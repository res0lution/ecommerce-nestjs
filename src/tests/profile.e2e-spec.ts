/* eslint-disable @typescript-eslint/no-unsafe-member-access -- supertest response typing */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- supertest */

import { getQueueToken } from '@nestjs/bullmq';
import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common/interfaces';
import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bullmq';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { AuthEmailProducer } from '../queues/auth-email.producer';
import { AUTH_EMAIL_QUEUE } from '../queues/queue.constants';

describe('Profile/Address (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService | undefined;
  let authEmailProducer: AuthEmailProducer;

  const email = `profile-e2e-${Date.now()}@test.com`;
  const password = 'password123';
  const nextPassword = 'password456';
  let accessToken = '';
  let refreshCookieHeader = '';
  let firstAddressId = '';
  let secondAddressId = '';

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
    authEmailProducer = app.get(AuthEmailProducer);
  });

  afterAll(async () => {
    if (prisma !== undefined) {
      await prisma.userAddress.deleteMany({
        where: { user: { email: { startsWith: 'profile-e2e-' } } },
      });
      await prisma.userSettings.deleteMany({
        where: { user: { email: { startsWith: 'profile-e2e-' } } },
      });
      await prisma.refreshToken.deleteMany({
        where: { user: { email: { startsWith: 'profile-e2e-' } } },
      });
      await prisma.authToken.deleteMany({
        where: { user: { email: { startsWith: 'profile-e2e-' } } },
      });
      await prisma.user.deleteMany({
        where: { email: { startsWith: 'profile-e2e-' } },
      });
      await prisma.$disconnect();
    }

    const authEmailQueue = app.get<Queue>(getQueueToken(AUTH_EMAIL_QUEUE), { strict: false });
    await authEmailQueue.close();
    await app.close();
  });

  it('register + verify + login for profile flow', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Profile E2E', email, password })
      .expect(201);

    const token = authEmailProducer.lastVerificationToken;
    expect(token).toBeTruthy();

    await request(app.getHttpServer()).post('/api/auth/verify-email').send({ token }).expect(200);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-forwarded-for', '10.0.0.11')
      .send({ email, password })
      .expect(200);

    accessToken = login.body.accessToken as string;
    const setCookie = login.headers['set-cookie'];
    const cookieParts: string[] = Array.isArray(setCookie)
      ? setCookie.filter((value): value is string => typeof value === 'string')
      : typeof setCookie === 'string'
        ? [setCookie]
        : [];
    refreshCookieHeader = cookieParts.map((c) => c.split(';')[0]).join('; ');
    expect(accessToken).toBeTruthy();
    expect(refreshCookieHeader).toContain('refreshToken');
  });

  it('patch /profile updates profile', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Updated Name',
        phone: '+123456789',
        avatarUrl: 'https://example.com/avatar.jpg',
      })
      .expect(200);

    expect(res.body.name).toBe('Updated Name');
    expect(res.body.phone).toBe('+123456789');
    expect(res.body.avatarUrl).toBe('https://example.com/avatar.jpg');
  });

  it('get /profile returns current profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.email).toBe(email);
    expect(res.body.name).toBe('Updated Name');
    expect(res.body.phone).toBe('+123456789');
  });

  it('post /profile/change-password invalidates refresh tokens', async () => {
    await request(app.getHttpServer())
      .post('/api/profile/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        oldPassword: password,
        newPassword: nextPassword,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookieHeader)
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-forwarded-for', '10.0.0.12')
      .send({ email, password })
      .expect(401);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-forwarded-for', '10.0.0.13')
      .send({ email, password: nextPassword })
      .expect(200);

    accessToken = login.body.accessToken as string;
  });

  it('post /addresses creates address and first one is default', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/addresses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        country: 'NL',
        city: 'Amsterdam',
        street: 'Main',
        house: '12',
        apartment: '5',
        postalCode: '1000AA',
      })
      .expect(201);

    expect(first.body.isDefault).toBe(true);
    firstAddressId = first.body.id as string;
    expect(firstAddressId).toBeTruthy();

    const second = await request(app.getHttpServer())
      .post('/api/addresses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        country: 'NL',
        city: 'Amsterdam',
        street: 'Second',
        house: '20',
        apartment: '10',
        postalCode: '2000BB',
      })
      .expect(201);

    secondAddressId = second.body.id as string;
    expect(secondAddressId).toBeTruthy();
    expect(second.body.isDefault).toBe(false);
  });

  it('post /addresses/:id/default switches default address', async () => {
    await request(app.getHttpServer())
      .post(`/api/addresses/${secondAddressId}/default`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/api/addresses')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const defaultAddresses = (list.body as Array<{ id: string; isDefault: boolean }>).filter(
      (item) => item.isDefault,
    );
    expect(defaultAddresses).toHaveLength(1);
    expect(defaultAddresses[0]?.id).toBe(secondAddressId);
  });

  it('patch /addresses/:id updates address', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/addresses/${secondAddressId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        city: 'Utrecht',
        postalCode: '3500AA',
      })
      .expect(200);

    expect(res.body.id).toBe(secondAddressId);
    expect(res.body.city).toBe('Utrecht');
    expect(res.body.postalCode).toBe('3500AA');
  });

  it('delete /addresses/:id deletes non-default address', async () => {
    await request(app.getHttpServer())
      .delete(`/api/addresses/${firstAddressId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/api/addresses')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const ids = (list.body as Array<{ id: string }>).map((item) => item.id);
    expect(ids).not.toContain(firstAddressId);
    expect(ids).toContain(secondAddressId);
  });

  it('get /settings returns defaults', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.userId).toBeTruthy();
    expect(res.body.language).toBe('en');
    expect(res.body.currency).toBe('USD');
    expect(res.body.notificationsEnabled).toBe(true);
  });

  it('patch /settings updates user settings', async () => {
    const updated = await request(app.getHttpServer())
      .patch('/api/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        language: 'de',
        currency: 'EUR',
        notificationsEnabled: false,
      })
      .expect(200);

    expect(updated.body.language).toBe('de');
    expect(updated.body.currency).toBe('EUR');
    expect(updated.body.notificationsEnabled).toBe(false);

    const fetched = await request(app.getHttpServer())
      .get('/api/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(fetched.body.language).toBe('de');
    expect(fetched.body.currency).toBe('EUR');
    expect(fetched.body.notificationsEnabled).toBe(false);
  });

  it('delete /profile soft deletes current user', async () => {
    await request(app.getHttpServer())
      .delete('/api/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const user = await prisma?.user.findUnique({
      where: { email },
      select: { deletedAt: true },
    });
    expect(user?.deletedAt).toBeTruthy();
  });
});
