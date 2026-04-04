import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { teardownE2eApp } from './e2e-teardown';

/* eslint-disable @typescript-eslint/no-unsafe-argument -- supertest */
describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    await teardownE2eApp(app, prisma);
  });

  it('/api (GET) returns 404 when no controller handles the route', () => {
    return request(app.getHttpServer()).get('/api').expect(404);
  });
});
