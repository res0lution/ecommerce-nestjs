import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default('*'),

  DATABASE_URL: z.string().url(),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  CATALOG_CACHE_ENABLED: z.coerce.boolean().default(true),
  CATALOG_CACHE_CATEGORIES_TTL_SECONDS: z.coerce.number().int().min(300).max(3600).default(900),
  CATALOG_CACHE_FILTERS_TTL_SECONDS: z.coerce.number().int().min(300).max(900).default(600),
  CATALOG_CACHE_PRODUCTS_LIST_TTL_SECONDS: z.coerce.number().int().min(30).max(120).default(60),
  CATALOG_CACHE_PRODUCT_DETAILS_TTL_SECONDS: z.coerce.number().int().min(60).max(300).default(180),
  COMMERCE_CACHE_ENABLED: z.coerce.boolean().default(true),
  COMMERCE_CACHE_CART_TTL_SECONDS: z.coerce.number().int().min(10).max(180).default(30),
  COMMERCE_CACHE_ORDERS_LIST_TTL_SECONDS: z.coerce.number().int().min(10).max(300).default(60),
  COMMERCE_CACHE_ORDER_DETAILS_TTL_SECONDS: z.coerce.number().int().min(10).max(300).default(90),

  ELASTICSEARCH_ENABLED: z.coerce.boolean().default(false),
  ELASTICSEARCH_NODE: z.string().url().default('http://localhost:9200'),
  ELASTICSEARCH_USERNAME: z.string().default('elastic'),
  ELASTICSEARCH_PASSWORD: z.string().optional().default(''),
  ELASTICSEARCH_API_KEY: z.string().optional().default(''),
  ELASTICSEARCH_PRODUCTS_INDEX: z.string().default('products_v1'),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('30d'),

  FRONTEND_URL: z.string().url().default('http://localhost:3001'),
  APP_URL: z.string().url().default('http://localhost:3000'),

  GOOGLE_CLIENT_ID: z
    .string()
    .optional()
    .transform((v) => ((v ?? '').length > 0 ? v! : 'placeholder.google.client')),
  GOOGLE_CLIENT_SECRET: z
    .string()
    .optional()
    .transform((v) => ((v ?? '').length > 0 ? v! : 'placeholder')),
  GOOGLE_CALLBACK_URL: z
    .string()
    .url()
    .optional()
    .default('http://localhost:3000/api/auth/google/callback'),

  YANDEX_CLIENT_ID: z
    .string()
    .optional()
    .transform((v) => ((v ?? '').length > 0 ? v! : 'placeholder.yandex.client')),
  YANDEX_CLIENT_SECRET: z
    .string()
    .optional()
    .transform((v) => ((v ?? '').length > 0 ? v! : 'placeholder')),
  YANDEX_CALLBACK_URL: z
    .string()
    .url()
    .optional()
    .default('http://localhost:3000/api/auth/yandex/callback'),

  RESEND_API_KEY: z.string().optional().default(''),
  RESEND_FROM: z.string().default('Auth <onboarding@resend.dev>'),

  AUTH_REFRESH_COOKIE_NAME: z.string().default('refreshToken'),

  CHECKOUT_CURRENCY: z.literal('RUB').default('RUB'),
  CHECKOUT_DELIVERY_FIXED_AMOUNT: z.coerce.number().min(0).default(0),

  YOOKASSA_SHOP_ID: z.string().optional().default(''),
  YOOKASSA_SECRET_KEY: z.string().optional().default(''),
  YOOKASSA_RETURN_URL: z.string().url().default('http://localhost:3001/checkout/result'),
  YOOKASSA_WEBHOOK_SECRET: z
    .string()
    .optional()
    .transform((v) => ((v ?? '').trim().length > 0 ? v! : 'dev-yookassa-webhook-secret')),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.flatten().fieldErrors;
    throw new Error(`Env validation failed: ${JSON.stringify(message)}`);
  }
  return parsed.data;
}

export const env = validateEnv();
