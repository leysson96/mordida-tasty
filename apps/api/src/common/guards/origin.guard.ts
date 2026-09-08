import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AppEnv, splitOrigins } from '../../config/env';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const SKIP_ORIGIN_GUARD_KEY = 'skipOriginGuard';

export const SkipOriginGuard = () => SetMetadata(SKIP_ORIGIN_GUARD_KEY, true);

function firstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeOrigin(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService<AppEnv, true>,
    private readonly reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext) {
    const skipOriginGuard = this.reflector.getAllAndOverride<boolean>(SKIP_ORIGIN_GUARD_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (skipOriginGuard) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    if (safeMethods.has(request.method.toUpperCase())) {
      return true;
    }

    const originHeader = firstHeaderValue(request.headers.origin);
    const refererHeader = firstHeaderValue(request.headers.referer ?? request.headers.referrer);
    const requestOrigin = originHeader ? normalizeOrigin(originHeader) : normalizeOrigin(refererHeader);

    if (!requestOrigin) {
      throw new ForbiddenException('Request origin is required.');
    }

    const allowedOrigins = new Set([
      ...splitOrigins(this.configService.get('CORS_ORIGIN', { infer: true })),
      this.configService.get('FRONTEND_URL', { infer: true })
    ].map(normalizeOrigin).filter((origin): origin is string => Boolean(origin)));

    if (!allowedOrigins.has(requestOrigin)) {
      throw new ForbiddenException('Request origin is not allowed.');
    }

    return true;
  }
}
