/* eslint-disable @typescript-eslint/no-unsafe-member-access -- supertest response typing */

/* eslint-disable @typescript-eslint/no-unsafe-argument -- supertest */
import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common/interfaces';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductGender } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { AuthEmailProducer } from '../queues/auth-email/auth-email.producer';
import { teardownE2eApp } from './e2e-teardown';

describe('Reviews (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService | undefined;
  let authEmailProducer: AuthEmailProducer;

  const now = Date.now();
  const categorySlug = `e2e-reviews-cat-${now}`;
  const productSlug = `e2e-reviews-product-${now}`;
  const email = `reviews-e2e-${now}@test.com`;
  const secondEmail = `reviews-e2e-second-${now}@test.com`;
  const password = 'password123';

  let productId = '';
  let accessToken = '';
  let secondAccessToken = '';
  let reviewId = '';
  let secondReviewId = '';

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
    authEmailProducer = app.get(AuthEmailProducer);
    await seedFixture();
  });

  afterAll(async () => {
    if (prisma !== undefined) {
      await prisma.review.deleteMany({
        where: {
          product: {
            slug: {
              startsWith: 'e2e-reviews-product-',
            },
          },
        },
      });
      await prisma.productVariant.deleteMany({
        where: {
          product: {
            slug: {
              startsWith: 'e2e-reviews-product-',
            },
          },
        },
      });
      await prisma.product.deleteMany({
        where: {
          slug: {
            startsWith: 'e2e-reviews-product-',
          },
        },
      });
      await prisma.category.deleteMany({
        where: {
          slug: {
            startsWith: 'e2e-reviews-cat-',
          },
        },
      });
      await prisma.refreshToken.deleteMany({
        where: {
          user: {
            email: {
              startsWith: 'reviews-e2e-',
            },
          },
        },
      });
      await prisma.authToken.deleteMany({
        where: {
          user: {
            email: {
              startsWith: 'reviews-e2e-',
            },
          },
        },
      });
      await prisma.user.deleteMany({
        where: {
          email: {
            startsWith: 'reviews-e2e-',
          },
        },
      });
    }
    await teardownE2eApp(app, prisma);
  });

  it('registers and logs in primary review user', async () => {
    accessToken = await registerAndLoginUser(email);
    expect(accessToken).toBeTruthy();
  });

  it('registers and logs in second review user', async () => {
    secondAccessToken = await registerAndLoginUser(secondEmail);
    expect(secondAccessToken).toBeTruthy();
  });

  it('returns 401 for protected endpoints without auth token', async () => {
    await request(app.getHttpServer())
      .post('/api/reviews')
      .send({
        productId,
        rating: 5,
        content: 'Unauthorized call body that should never create an entity here.',
      })
      .expect(401);
    await request(app.getHttpServer())
      .patch('/api/reviews/00000000-0000-0000-0000-000000000001')
      .send({
        content: 'Unauthorized patch content with enough characters for validation.',
      })
      .expect(401);
    await request(app.getHttpServer())
      .delete('/api/reviews/00000000-0000-0000-0000-000000000001')
      .expect(401);
  });

  it('creates review and updates product aggregates', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/reviews')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        productId,
        rating: 5,
        title: 'Perfect for daily use',
        content: 'Really comfortable pair for daily runs, quality is good and stable on road.',
      })
      .expect(201);

    reviewId = response.body.id as string;
    expect(response.body.status).toBe('APPROVED');

    const product = await prisma?.product.findUniqueOrThrow({
      where: { id: productId },
      select: {
        ratingAvg: true,
        reviewsCount: true,
        rating5: true,
      },
    });
    expect(product?.ratingAvg).toBe(5);
    expect(product?.reviewsCount).toBe(1);
    expect(product?.rating5).toBe(1);
  });

  it('prevents duplicate review for same user/product', async () => {
    await request(app.getHttpServer())
      .post('/api/reviews')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        productId,
        rating: 4,
        content: 'Second message with enough symbols to pass validation but should fail duplicate.',
      })
      .expect(409);
  });

  it('creates second user review', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/reviews')
      .set('Authorization', `Bearer ${secondAccessToken}`)
      .send({
        productId,
        rating: 2,
        content: 'The pair did not fit me well and felt unstable on long sessions.',
      })
      .expect(201);

    secondReviewId = response.body.id as string;
    expect(secondReviewId).toBeTruthy();
  });

  it('lists product reviews with latest sorting', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/products/${productId}/reviews`)
      .query({ page: 1, limit: 10, sort: 'latest' })
      .expect(200);

    expect(response.body.meta.total).toBe(2);
    expect(response.body.items[0].id).toBe(secondReviewId);
  });

  it('lists product reviews with rating sorting', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/products/${productId}/reviews`)
      .query({ page: 1, limit: 10, sort: 'rating' })
      .expect(200);

    expect(response.body.meta.total).toBe(2);
    expect(response.body.items[0].id).toBe(reviewId);
    expect(response.body.items[0].rating).toBe(5);
  });

  it('filters product reviews by rating', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/products/${productId}/reviews`)
      .query({ page: 1, limit: 10, sort: 'latest', rating: 5 })
      .expect(200);

    expect(response.body.meta.total).toBe(1);
    expect(response.body.items[0].id).toBe(reviewId);
  });

  it('validates unsupported and unknown list query params', async () => {
    await request(app.getHttpServer())
      .get(`/api/products/${productId}/reviews`)
      .query({ sort: 'helpful' })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/products/${productId}/reviews`)
      .query({ withImages: true })
      .expect(400);
  });

  it('returns 404 when listing reviews for unknown product', async () => {
    await request(app.getHttpServer())
      .get('/api/products/00000000-0000-0000-0000-000000000001/reviews')
      .expect(404);
  });

  it('updates own review and recalculates product rating', async () => {
    await request(app.getHttpServer())
      .patch(`/api/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        rating: 4,
        content:
          'Updated content remains detailed enough and keeps useful context for a realistic update.',
      })
      .expect(200);

    const product = await prisma?.product.findUniqueOrThrow({
      where: { id: productId },
      select: {
        ratingAvg: true,
        reviewsCount: true,
        rating4: true,
        rating5: true,
      },
    });
    expect(product?.ratingAvg).toBe(3);
    expect(product?.reviewsCount).toBe(2);
    expect(product?.rating4).toBe(1);
    expect(product?.rating5).toBe(0);
  });

  it('returns 404 when updating missing own review', async () => {
    await request(app.getHttpServer())
      .patch('/api/reviews/00000000-0000-0000-0000-000000000099')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: 'Patch for missing review should fail with not found response.',
      })
      .expect(404);
  });

  it('deletes own review and clears aggregates', async () => {
    await request(app.getHttpServer())
      .delete(`/api/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const product = await prisma?.product.findUniqueOrThrow({
      where: { id: productId },
      select: {
        ratingAvg: true,
        reviewsCount: true,
      },
    });
    expect(product?.ratingAvg).toBe(2);
    expect(product?.reviewsCount).toBe(1);
  });

  it('deletes second review and clears all aggregates', async () => {
    await request(app.getHttpServer())
      .delete(`/api/reviews/${secondReviewId}`)
      .set('Authorization', `Bearer ${secondAccessToken}`)
      .expect(200);

    const product = await prisma?.product.findUniqueOrThrow({
      where: { id: productId },
      select: {
        ratingAvg: true,
        reviewsCount: true,
      },
    });
    expect(product?.ratingAvg).toBe(0);
    expect(product?.reviewsCount).toBe(0);
  });

  async function seedFixture(): Promise<void> {
    if (!prisma) {
      throw new Error('PrismaService is not initialized');
    }
    const category = await prisma.category.create({
      data: {
        name: 'Reviews Category',
        slug: categorySlug,
        level: 0,
      },
    });
    const product = await prisma.product.create({
      data: {
        title: 'Reviews Product',
        slug: productSlug,
        description: 'Test product for reviews',
        categoryId: category.id,
        brand: 'Nike',
        gender: ProductGender.UNISEX,
        isActive: true,
      },
    });
    await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `e2e-reviews-sku-${now}`,
        price: 100,
        oldPrice: null,
        color: 'black',
        size: '42',
        stock: 3,
        isActive: true,
      },
    });
    productId = product.id;
  }

  async function registerAndLoginUser(userEmail: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Reviews E2E', email: userEmail, password })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/verify-email')
      .send({ token: authEmailProducer.lastVerificationToken })
      .expect(200);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: userEmail, password })
      .expect(200);

    return login.body.accessToken as string;
  }
});
