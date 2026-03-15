import { env } from './env.validation';

export default (): Record<string, unknown> => ({
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  corsOrigin: env.CORS_ORIGIN,

  database: {
    url: env.DATABASE_URL,
  },

  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    url: `redis://${env.REDIS_HOST}:${env.REDIS_PORT}`,
  },

  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    usePretty: env.NODE_ENV !== 'production',
  },

  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpires: env.JWT_ACCESS_EXPIRES,
    refreshExpires: env.JWT_REFRESH_EXPIRES,
  },

  frontendUrl: env.FRONTEND_URL,
  appUrl: env.APP_URL,

  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackUrl: env.GOOGLE_CALLBACK_URL,
  },

  yandex: {
    clientId: env.YANDEX_CLIENT_ID,
    clientSecret: env.YANDEX_CLIENT_SECRET,
    callbackUrl: env.YANDEX_CALLBACK_URL,
  },

  resend: {
    apiKey: env.RESEND_API_KEY,
    from: env.RESEND_FROM,
  },

  auth: {
    refreshCookieName: env.AUTH_REFRESH_COOKIE_NAME,
    cookieSecure: env.NODE_ENV === 'production',
  },
});
