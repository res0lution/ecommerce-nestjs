import { env } from './env.validation';

export default () => ({
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
});
