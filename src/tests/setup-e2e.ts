import { config } from 'dotenv';

config({ path: '.env' });

process.env.NODE_ENV = 'test';

const setIfShort = (key: string, value: string, minLen: number): void => {
  const cur = process.env[key];
  if (cur === undefined || cur === '' || cur.length < minLen) {
    process.env[key] = value;
  }
};

setIfShort('JWT_ACCESS_SECRET', 'e2e-jwt-access-secret-min16', 16);
setIfShort('JWT_REFRESH_SECRET', 'e2e-jwt-refresh-secret-m16', 16);

if (process.env.GOOGLE_CLIENT_ID === undefined || process.env.GOOGLE_CLIENT_ID === '') {
  process.env.GOOGLE_CLIENT_ID = 'e2e-google-client-id.apps.googleusercontent.com';
}
if (process.env.GOOGLE_CLIENT_SECRET === undefined || process.env.GOOGLE_CLIENT_SECRET === '') {
  process.env.GOOGLE_CLIENT_SECRET = 'e2e-google-secret';
}
if (process.env.YANDEX_CLIENT_ID === undefined || process.env.YANDEX_CLIENT_ID === '') {
  process.env.YANDEX_CLIENT_ID = 'e2e-yandex-client';
}
if (process.env.YANDEX_CLIENT_SECRET === undefined || process.env.YANDEX_CLIENT_SECRET === '') {
  process.env.YANDEX_CLIENT_SECRET = 'e2e-yandex-secret';
}
