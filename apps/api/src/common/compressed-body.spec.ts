import { Body, Controller, INestApplication, Post, RawBodyRequest, Req } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { gzipSync } from 'node:zlib';

@Controller('body-probe')
class BodyProbeController {
  @Post()
  read(@Body() body: unknown, @Req() request: RawBodyRequest<Request>) {
    return { body, raw: request.rawBody?.toString('utf8') };
  }
}

describe('Compressed body security and raw webhook compatibility', () => {
  let app: INestApplication;
  let url: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [BodyProbeController] }).compile();
    app = module.createNestApplication({ rawBody: true });
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });
  afterAll(async () => { await app.close(); });

  it('parses valid gzip JSON and preserves raw-body bytes', async () => {
    const json = JSON.stringify({ event: 'test', amount: 1190 });
    const response = await fetch(url + '/body-probe', {
      method: 'POST', headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' },
      body: new Uint8Array(gzipSync(json)),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ body: JSON.parse(json), raw: json });
  });

  it('rejects invalid compressed trailing bytes and keeps accepting requests', async () => {
    const malformed = Buffer.concat([gzipSync('{"ok":true}'), Buffer.from('invalid trailing bytes')]);
    const response = await fetch(url + '/body-probe', {
      method: 'POST', headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' },
      body: new Uint8Array(malformed),
    });
    expect(response.status).toBe(400);
    await response.text();
    const healthy = await fetch(url + '/body-probe', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"ok":true}',
    });
    expect(healthy.status).toBe(201);
    expect(await healthy.json()).toEqual({ body: { ok: true }, raw: '{"ok":true}' });
  });
});
