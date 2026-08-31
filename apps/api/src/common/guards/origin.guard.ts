import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AppEnv, splitOrigins } from '../../config/env';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly configService: ConfigService<AppEnv, true>) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();

    if (safeMethods.has(request.method.toUpperCase())) {
      return true;
    }

    const origin = request.headers.origin;
    if (!origin) {
      return true;
    }

    const allowedOrigins = new Set([
      ...splitOrigins(this.configService.get('CORS_ORIGIN', { infer: true })),
      this.configService.get('FRONTEND_URL', { infer: true })
    ]);

    if (!allowedOrigins.has(origin)) {
      throw new ForbiddenException('Request origin is not allowed.');
    }

    return true;
  }
}
