import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'], // production logger
  });

  // Global API prefix
  app.setGlobalPrefix('api');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: true,
  });

  // Graceful shutdown
  app.enableShutdownHooks();

  const portRaw = process.env.PORT;
  const port = typeof portRaw === 'string' && portRaw !== '' ? parseInt(portRaw, 10) : 3000;
  await app.listen(port);

  Logger.log(`Application is running on: http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
