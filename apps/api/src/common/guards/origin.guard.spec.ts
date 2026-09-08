import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AppEnv } from '../../config/env';
import { OriginGuard, SkipOriginGuard } from './origin.guard';

class TestController {}

class WebhookController {
  @SkipOriginGuard()
  handleWebhook() {}
}

function handler() {}

function createContext(
  method: string,
  headers: Request['headers'] = {},
  routeHandler: Function = handler,
  controller: Function = TestController
) {
  const request = { method, headers } as Request;

  return {
    switchToHttp: () => ({
      getRequest: () => request
    }),
    getHandler: () => routeHandler,
    getClass: () => controller
  } as ExecutionContext;
}

describe('OriginGuard', () => {
  let guard: OriginGuard;

  beforeEach(() => {
    const configService = {
      get: jest.fn((key: keyof AppEnv) => {
        const values: Partial<AppEnv> = {
          CORS_ORIGIN: 'https://mordidatasty.es, http://localhost:3000/',
          FRONTEND_URL: 'https://www.mordidatasty.es/'
        };

        return values[key];
      })
    } as unknown as ConfigService<AppEnv, true>;

    guard = new OriginGuard(configService, new Reflector());
  });

  it('allows safe requests without browser origin headers', () => {
    expect(guard.canActivate(createContext('GET'))).toBe(true);
  });

  it('allows mutating requests from an allowed Origin', () => {
    expect(
      guard.canActivate(createContext('POST', { origin: 'https://mordidatasty.es' }))
    ).toBe(true);
  });

  it('allows mutating requests with an allowed Referer when Origin is absent', () => {
    expect(
      guard.canActivate(
        createContext('POST', { referer: 'https://www.mordidatasty.es/checkout' })
      )
    ).toBe(true);
  });

  it('rejects mutating requests without Origin or Referer', () => {
    expect(() => guard.canActivate(createContext('POST'))).toThrow(ForbiddenException);
  });

  it('rejects mutating requests from a disallowed Origin', () => {
    expect(() =>
      guard.canActivate(createContext('PATCH', { origin: 'https://evil.example' }))
    ).toThrow(ForbiddenException);
  });

  it('rejects malformed Origin values', () => {
    expect(() => guard.canActivate(createContext('POST', { origin: 'null' }))).toThrow(
      ForbiddenException
    );
  });

  it('allows explicitly skipped server-to-server handlers without Origin', () => {
    const routeHandler = WebhookController.prototype.handleWebhook;

    expect(
      guard.canActivate(createContext('POST', {}, routeHandler, WebhookController))
    ).toBe(true);
  });
});
