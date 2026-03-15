import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default('*'),

  DATABASE_URL: z.string().url(),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

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
