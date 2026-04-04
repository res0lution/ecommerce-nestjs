/* eslint-disable @typescript-eslint/no-unsafe-member-access -- supertest response typing */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- supertest */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- supertest response typing */
/* eslint-disable @typescript-eslint/no-unsafe-call -- supertest response typing */
import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common/interfaces';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductGender } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { CatalogCacheService } from '../modules/catalog/cache/catalog-cache.service';
import { teardownE2eApp } from './e2e-teardown';

describe('Catalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService | undefined;
  let primaryProductId = '';
  const now = Date.now();
  const menSlug = `e2e-men-${now}`;
  const kidsSlug = `e2e-kids-${now}`;
  const kidsVariantSize = `e2e-kids-size-${now}`;
  const primarySlug = `e2e-runner-${now}`;
  const recommendationSlug = `e2e-trail-${now}`;
  const kidsProductSlug = `e2e-kids-runner-${now}`;

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

    const catalogCache = app.get(CatalogCacheService);
    await catalogCache.invalidateCategory();

    prisma = app.get(PrismaService);
    if (!prisma) {
      throw new Error('PrismaService is not initialized');
    }
    await seedCatalogFixture(prisma);
  });

  afterAll(async () => {
    if (prisma !== undefined) {
      await prisma.productAttributeValue.deleteMany({
        where: {
          product: {
            slug: {
              startsWith: 'e2e-',
            },
          },
        },
      });
      await prisma.review.deleteMany({
        where: {
          product: {
            slug: {
              startsWith: 'e2e-',
            },
          },
        },
      });
      await prisma.productImage.deleteMany({
        where: {
          product: {
            slug: {
              startsWith: 'e2e-',
            },
          },
        },
      });
      await prisma.productVariant.deleteMany({
        where: {
          product: {
            slug: {
              startsWith: 'e2e-',
            },
          },
        },
      });
      await prisma.product.deleteMany({
        where: {
          slug: {
            startsWith: 'e2e-',
          },
        },
      });
      await prisma.attributeValue.deleteMany({
        where: {
          value: {
            in: ['E2E-Men', 'E2E-Running'],
          },
        },
      });
      await prisma.attribute.deleteMany({
        where: {
          name: {
            in: ['Gender', 'Sport'],
          },
        },
      });
      await prisma.category.deleteMany({
        where: {
          slug: {
            startsWith: 'e2e-',
          },
        },
      });
    }
    await teardownE2eApp(app, prisma);
  });

  it('GET /api/categories returns category tree', async () => {
    const res = await request(app.getHttpServer()).get('/api/categories').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    const menNode = res.body.find((node: { slug: string }) => node.slug === menSlug);
    expect(menNode).toBeTruthy();
    expect(Array.isArray(menNode.children)).toBe(true);
  });

  it('GET /api/categories returns stable payload on repeated calls', async () => {
    const first = await request(app.getHttpServer()).get('/api/categories').expect(200);
    const second = await request(app.getHttpServer()).get('/api/categories').expect(200);
    expect(second.body).toEqual(first.body);
  });

  it('GET /api/products supports filters and sorting', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/products')
      .query({
        category: menSlug,
        priceFrom: 90,
        priceTo: 130,
        size: '42',
        sort: 'price_asc',
      })
      .expect(200);

    expect(res.body.total).toBeGreaterThanOrEqual(1);
    const prices = res.body.items.map((item: { price: number }) => item.price);
    expect(prices[0]).toBeLessThanOrEqual(prices[prices.length - 1]);
    expect(res.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: primaryProductId, price: 100 })]),
    );
  });

  it('GET /api/products validates query values', async () => {
    await request(app.getHttpServer())
      .get('/api/products')
      .query({ sort: 'invalid_sort' })
      .expect(400);
    await request(app.getHttpServer()).get('/api/products').query({ limit: 101 }).expect(400);
    await request(app.getHttpServer()).get('/api/products').query({ page: 0 }).expect(400);
  });

  it('GET /api/products/filters is category-aware', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/products/filters')
      .query({ category: menSlug })
      .expect(200);

    expect(res.body.sizes).toEqual(expect.arrayContaining(['42']));
    expect(res.body.genders).toEqual(expect.arrayContaining(['E2E-Men']));
    expect(res.body.sports).toEqual(expect.arrayContaining(['E2E-Running']));
    expect(res.body.priceRanges[0]).toEqual({ from: 90, to: 160 });
  });

  it('GET /api/products/:slug returns card with SKU data', async () => {
    const res = await request(app.getHttpServer()).get(`/api/products/${primarySlug}`).expect(200);
    expect(res.body.id).toBe(primaryProductId);
    expect(Array.isArray(res.body.variants)).toBe(true);
    expect(res.body.sizes).toEqual(expect.arrayContaining([{ size: '42', available: true }]));
  });

  it('GET /api/products/:slug keeps static card cached but returns fresh availability', async () => {
    const first = await request(app.getHttpServer())
      .get(`/api/products/${primarySlug}`)
      .expect(200);
    await prisma?.productVariant.updateMany({
      where: {
        sku: `e2e-sku-${now}-1`,
      },
      data: {
        stock: 0,
      },
    });
    const second = await request(app.getHttpServer())
      .get(`/api/products/${primarySlug}`)
      .expect(200);

    expect(second.body.id).toBe(first.body.id);
    expect(second.body.title).toBe(first.body.title);
    expect(second.body.description).toBe(first.body.description);
    expect(second.body.images).toEqual(first.body.images);
    expect(second.body.attributes).toEqual(first.body.attributes);
    expect(second.body.sizes).toEqual(expect.arrayContaining([{ size: '42', available: false }]));
  });

  it('GET /api/products/:slug returns 404 for unknown slug', async () => {
    await request(app.getHttpServer()).get('/api/products/e2e-missing-slug').expect(404);
  });

  it('GET /api/products/:id/recommendations returns related products', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/products/${primaryProductId}/recommendations`)
      .expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.some((item: { title: string }) => item.title === 'Trail Shoe')).toBe(
      true,
    );
  });

  it('GET /api/products/:id/recommendations validates UUID', async () => {
    await request(app.getHttpServer()).get('/api/products/not-a-uuid/recommendations').expect(400);
  });

  it('GET /api/products with kids=true includes kids branch products', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/products')
      .query({
        kids: true,
        size: kidsVariantSize,
      })
      .expect(200);

    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(
      res.body.items.some(
        (item: { id: string; title: string }) => item.title === 'Kids Runner Shoe',
      ),
    ).toBe(true);
  });

  async function seedCatalogFixture(db: PrismaService): Promise<void> {
    const men = await db.category.create({
      data: {
        name: 'Men',
        slug: menSlug,
        level: 0,
      },
    });
    const kidsRoot = await db.category.upsert({
      where: {
        slug: 'kids',
      },
      update: {},
      create: {
        name: 'Kids',
        slug: 'kids',
        level: 0,
      },
    });
    await db.category.create({
      data: {
        name: 'Kids Collection',
        slug: kidsSlug,
        parentId: kidsRoot.id,
        level: kidsRoot.level + 1,
      },
    });

    const genderAttr = await db.attribute.upsert({
      where: { name: 'Gender' },
      update: {},
      create: { name: 'Gender' },
    });
    const sportAttr = await db.attribute.upsert({
      where: { name: 'Sport' },
      update: {},
      create: { name: 'Sport' },
    });
    const menValue = await db.attributeValue.create({
      data: {
        attributeId: genderAttr.id,
        value: 'E2E-Men',
      },
    });
    const runValue = await db.attributeValue.create({
      data: {
        attributeId: sportAttr.id,
        value: 'E2E-Running',
      },
    });

    const primary = await db.product.create({
      data: {
        title: 'Runner Shoe',
        slug: primarySlug,
        description: 'Runner',
        categoryId: men.id,
        brand: 'Nike',
        gender: ProductGender.MEN,
        isActive: true,
        isBestSeller: true,
        popularityScore: 50,
      },
    });
    primaryProductId = primary.id;

    await db.productVariant.createMany({
      data: [
        {
          productId: primary.id,
          sku: `e2e-sku-${now}-1`,
          price: 100,
          oldPrice: 130,
          color: 'red',
          size: '42',
          stock: 10,
          isActive: true,
        },
        {
          productId: primary.id,
          sku: `e2e-sku-${now}-2`,
          price: 160,
          oldPrice: null,
          color: 'blue',
          size: '43',
          stock: 0,
          isActive: true,
        },
      ],
    });

    const firstVariant = await db.productVariant.findUniqueOrThrow({
      where: { sku: `e2e-sku-${now}-1` },
    });
    await db.productImage.createMany({
      data: [
        {
          productId: primary.id,
          variantId: firstVariant.id,
          url: 'https://img/runner-red',
          sortOrder: 0,
        },
        { productId: primary.id, variantId: null, url: 'https://img/runner-main', sortOrder: 0 },
      ],
    });
    await db.productAttributeValue.createMany({
      data: [
        { productId: primary.id, attributeValueId: menValue.id },
        { productId: primary.id, attributeValueId: runValue.id },
      ],
    });

    const user = await db.user.create({
      data: {
        email: `e2e-catalog-${now}@test.com`,
        provider: 'LOCAL',
        emailVerified: true,
      },
    });
    await db.review.create({
      data: {
        productId: primary.id,
        userId: user.id,
        rating: 5,
        comment: 'Great',
      },
    });

    const recommendation = await db.product.create({
      data: {
        title: 'Trail Shoe',
        slug: recommendationSlug,
        description: 'Trail',
        categoryId: men.id,
        brand: 'Nike',
        gender: ProductGender.MEN,
        isActive: true,
        popularityScore: 20,
      },
    });
    await db.productVariant.create({
      data: {
        productId: recommendation.id,
        sku: `e2e-sku-${now}-3`,
        price: 90,
        oldPrice: null,
        color: 'red',
        size: '42',
        stock: 2,
        isActive: true,
      },
    });
    await db.productAttributeValue.createMany({
      data: [
        { productId: recommendation.id, attributeValueId: menValue.id },
        { productId: recommendation.id, attributeValueId: runValue.id },
      ],
    });

    const kidsCategory = await db.category.findUniqueOrThrow({
      where: { slug: kidsSlug },
    });
    const kidsProduct = await db.product.create({
      data: {
        title: 'Kids Runner Shoe',
        slug: kidsProductSlug,
        description: 'Kids runner',
        categoryId: kidsCategory.id,
        brand: 'Nike',
        gender: ProductGender.UNISEX,
        isActive: true,
        popularityScore: 30,
      },
    });
    await db.productVariant.create({
      data: {
        productId: kidsProduct.id,
        sku: `e2e-sku-${now}-kids`,
        price: 70,
        oldPrice: null,
        color: 'green',
        size: kidsVariantSize,
        stock: 4,
        isActive: true,
      },
    });
  }
});
