/* eslint-disable @typescript-eslint/no-unsafe-member-access -- supertest response typing */

/* eslint-disable @typescript-eslint/no-unsafe-argument -- supertest */
import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common/interfaces';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, ProductGender } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { createHmac } from 'crypto';
import request from 'supertest';

import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { AuthEmailProducer } from '../queues/auth-email/auth-email.producer';
import { teardownE2eApp } from './e2e-teardown';

describe('Commerce (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService | undefined;
  let authEmailProducer: AuthEmailProducer;

  const now = Date.now();
  const categorySlug = `e2e-commerce-cat-${now}`;
  const productSlug = `e2e-commerce-product-${now}`;
  const sku = `e2e-commerce-sku-${now}`;
  const email = `commerce-e2e-${now}@test.com`;
  const password = 'password123';

  let accessToken = '';
  let variantId = '';
  let paidOrderId = '';
  let paidOrderProviderPaymentId = '';
  let paidOrderAmount = '0.00';
  let pendingOrderId = '';
  let shippedOrderId = '';

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
      await prisma.paymentWebhookEvent.deleteMany({
        where: {
          eventId: {
            startsWith: 'e2e-commerce-',
          },
        },
      });
      await prisma.payment.deleteMany({
        where: {
          order: {
            user: {
              email: {
                startsWith: 'commerce-e2e-',
              },
            },
          },
        },
      });
      await prisma.orderItem.deleteMany({
        where: {
          order: {
            user: {
              email: {
                startsWith: 'commerce-e2e-',
              },
            },
          },
        },
      });
      await prisma.order.deleteMany({
        where: {
          user: {
            email: {
              startsWith: 'commerce-e2e-',
            },
          },
        },
      });
      await prisma.cartItem.deleteMany({
        where: {
          cart: {
            user: {
              email: {
                startsWith: 'commerce-e2e-',
              },
            },
          },
        },
      });
      await prisma.cart.deleteMany({
        where: {
          user: {
            email: {
              startsWith: 'commerce-e2e-',
            },
          },
        },
      });
      await prisma.productVariant.deleteMany({
        where: {
          sku: {
            startsWith: 'e2e-commerce-sku-',
          },
        },
      });
      await prisma.product.deleteMany({
        where: {
          slug: {
            startsWith: 'e2e-commerce-product-',
          },
        },
      });
      await prisma.category.deleteMany({
        where: {
          slug: {
            startsWith: 'e2e-commerce-cat-',
          },
        },
      });
      await prisma.refreshToken.deleteMany({
        where: {
          user: {
            email: {
              startsWith: 'commerce-e2e-',
            },
          },
        },
      });
      await prisma.authToken.deleteMany({
        where: {
          user: {
            email: {
              startsWith: 'commerce-e2e-',
            },
          },
        },
      });
      await prisma.user.deleteMany({
        where: {
          email: {
            startsWith: 'commerce-e2e-',
          },
        },
      });
    }
    await teardownE2eApp(app, prisma);
  });

  it('registers and logs in user', async () => {
    accessToken = await registerAndLoginUser(email);
    expect(accessToken).toBeTruthy();
  });

  it('adds item to cart and returns calculated summary', async () => {
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        variantId,
        quantity: 2,
      })
      .expect(201);

    const cartResponse = await request(app.getHttpServer())
      .get('/api/cart')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(cartResponse.body.items).toHaveLength(1);
    expect(cartResponse.body.subtotal).toBe(100);
    expect(cartResponse.body.deliveryAmount).toBeGreaterThanOrEqual(0);
    expect(cartResponse.body.totalAmount).toBeGreaterThanOrEqual(100);
  });

  it('updates and deletes cart item, then clears cart', async () => {
    const addResponse = await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        variantId,
        quantity: 1,
      })
      .expect(201);

    const itemId = (addResponse.body.items as Array<{ itemId: string }>)[0]?.itemId;
    expect(itemId).toBeTruthy();

    await request(app.getHttpServer())
      .patch(`/api/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ quantity: 2 })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete('/api/cart')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const cartAfter = await request(app.getHttpServer())
      .get('/api/cart')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(cartAfter.body.items).toHaveLength(0);
  });

  it('checks out, processes payment.succeeded webhook, then returns order in list', async () => {
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        variantId,
        quantity: 2,
      })
      .expect(201);

    const checkoutResponse = await request(app.getHttpServer())
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        paymentMethod: 'yookassa',
      })
      .expect(201);

    paidOrderId = checkoutResponse.body.orderId as string;
    expect(checkoutResponse.body.payment.confirmationUrl).toBeTruthy();

    const payment = await prisma?.payment.findUnique({
      where: { orderId: paidOrderId },
      select: {
        providerPaymentId: true,
        amount: true,
      },
    });
    paidOrderProviderPaymentId = payment?.providerPaymentId ?? '';
    paidOrderAmount = payment?.amount.toFixed(2) ?? '0.00';
    expect(paidOrderProviderPaymentId).toBeTruthy();

    const succeededPayload = {
      id: `e2e-commerce-succeeded-${now}`,
      event: 'payment.succeeded',
      object: {
        id: paidOrderProviderPaymentId,
        status: 'succeeded',
        created_at: new Date().toISOString(),
        amount: {
          value: paidOrderAmount,
          currency: 'RUB',
        },
      },
    };

    await postYooKassaWebhook(succeededPayload).expect(200);

    const ordersResponse = await request(app.getHttpServer())
      .get('/api/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const order = (ordersResponse.body as Array<{ orderId: string; statusLabel: string }>).find(
      (item) => item.orderId === paidOrderId,
    );
    expect(order).toBeDefined();
    expect(order?.statusLabel).toBe('PAID');

    await request(app.getHttpServer())
      .get(`/api/orders/${paidOrderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/payments/${paidOrderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('cancels pending order successfully', async () => {
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        variantId,
        quantity: 1,
      })
      .expect(201);

    const checkoutResponse = await request(app.getHttpServer())
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        paymentMethod: 'yookassa',
      })
      .expect(201);

    pendingOrderId = checkoutResponse.body.orderId as string;

    await request(app.getHttpServer())
      .post(`/api/orders/${pendingOrderId}/cancel`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'Changed my mind' })
      .expect(200);
  });

  it('returns 409 for quantity greater than stock', async () => {
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        variantId,
        quantity: 999,
      })
      .expect(409);
  });

  it('returns 409 when trying to cancel shipped order', async () => {
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        variantId,
        quantity: 1,
      })
      .expect(201);

    const checkoutResponse = await request(app.getHttpServer())
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        paymentMethod: 'yookassa',
      })
      .expect(201);

    shippedOrderId = checkoutResponse.body.orderId as string;

    await prisma?.order.update({
      where: { id: shippedOrderId },
      data: { status: OrderStatus.SHIPPED },
    });

    await request(app.getHttpServer())
      .post(`/api/orders/${shippedOrderId}/cancel`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'Too late' })
      .expect(409);
  });

  it('handles duplicate webhook idempotently', async () => {
    const eventId = `e2e-commerce-duplicate-${now}`;
    const payload = {
      id: eventId,
      event: 'payment.succeeded',
      object: {
        id: paidOrderProviderPaymentId,
        status: 'succeeded',
        created_at: new Date().toISOString(),
        amount: {
          value: paidOrderAmount,
          currency: 'RUB',
        },
      },
    };

    await postYooKassaWebhook(payload).expect(200);
    await postYooKassaWebhook(payload).expect(200);

    const eventsCount = await prisma?.paymentWebhookEvent.count({
      where: {
        eventId,
      },
    });
    expect(eventsCount).toBe(1);
  });

  it('rejects webhook with invalid signature', async () => {
    await request(app.getHttpServer())
      .post('/api/payments/webhooks/yookassa')
      .set('x-yookassa-signature', 'sha256=invalid')
      .send({
        id: `e2e-commerce-invalid-sign-${now}`,
        event: 'payment.succeeded',
        object: {
          id: paidOrderProviderPaymentId,
          status: 'succeeded',
          created_at: new Date().toISOString(),
          amount: {
            value: paidOrderAmount,
            currency: 'RUB',
          },
        },
      })
      .expect(401);
  });

  async function seedFixture(): Promise<void> {
    if (!prisma) {
      throw new Error('PrismaService is not initialized');
    }
    const category = await prisma.category.create({
      data: {
        name: 'Commerce Category',
        slug: categorySlug,
        level: 0,
      },
    });
    const product = await prisma.product.create({
      data: {
        title: 'Commerce Product',
        slug: productSlug,
        description: 'Product for cart/order/payment e2e',
        categoryId: category.id,
        brand: 'Nike',
        gender: ProductGender.UNISEX,
        isActive: true,
      },
    });
    const createdVariant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku,
        price: 50,
        oldPrice: null,
        color: 'black',
        size: '42',
        stock: 5,
        isActive: true,
      },
    });
    variantId = createdVariant.id;
  }

  async function registerAndLoginUser(userEmail: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Commerce E2E', email: userEmail, password })
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

  function webhookSecret(): string {
    const secret = process.env.YOOKASSA_WEBHOOK_SECRET ?? '';
    return secret.trim().length > 0 ? secret : 'dev-yookassa-webhook-secret';
  }

  function signYooKassaPayload(payload: Record<string, unknown>): string {
    const digest = createHmac('sha256', webhookSecret())
      .update(JSON.stringify(payload))
      .digest('hex');
    return `sha256=${digest}`;
  }

  function postYooKassaWebhook(payload: Record<string, unknown>): request.Test {
    return request(app.getHttpServer())
      .post('/api/payments/webhooks/yookassa')
      .set('x-yookassa-signature', signYooKassaPayload(payload))
      .send(payload);
  }
});
