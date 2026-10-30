import { Controller, Get, INestApplication, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { SkipThrottle, Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Controller()
class RateLimitProbeController {
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login() { return { ok: true }; }

  @Get('health')
  health() { return { ok: true }; }

  @Post('webhook')
  @SkipThrottle()
  webhook() { return { ok: true }; }
}

describe('Rate limit HTTP contract with installed storage', () => {
  let app: INestApplication;
  let baseUrl: string;
  async function send(path: string, method: string, status: number) {
    const response = await fetch(baseUrl + path, { method });
    await response.text();
    expect(response.status).toBe(status);
    return response;
  }
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }])],
      controllers: [RateLimitProbeController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });
  afterEach(async () => { await app.close(); });

  it('returns 429 and Retry-After for the sixth login without blocking health', async () => {
    for (let i = 0; i < 5; i++) await send('/login', 'POST', 201);
    const blocked = await send('/login', 'POST', 429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    await send('/health', 'GET', 200);
  });

  it('keeps the default limit and explicitly exempt webhooks', async () => {
    for (let i = 0; i < 120; i++) await send('/health', 'GET', 200);
    await send('/health', 'GET', 429);
    for (let i = 0; i < 121; i++) await send('/webhook', 'POST', 201);
  });
});
