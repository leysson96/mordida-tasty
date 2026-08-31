import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import cookieParser = require('cookie-parser');
import helmet from 'helmet';
import { mkdirSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { AppModule } from './app.module';
import { AppEnv, splitOrigins } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const configService = app.get(ConfigService<AppEnv, true>);
  const isProduction = configService.get('NODE_ENV', { infer: true }) === 'production';

  if (isProduction) {
    app.set('trust proxy', 1);
  }

  const uploadsDir = configService.get('UPLOAD_DIR', { infer: true });
  const uploadsPath = isAbsolute(uploadsDir) ? uploadsDir : resolve(process.cwd(), uploadsDir);

  mkdirSync(uploadsPath, { recursive: true });

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
  );
  app.useStaticAssets(uploadsPath, { prefix: '/uploads/' });
  app.use(cookieParser());
  app.enableCors({
    origin: splitOrigins(configService.get('CORS_ORIGIN', { infer: true })),
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  await app.listen(configService.get('PORT', { infer: true }));
}

bootstrap();
