import { Controller, INestApplication, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { UploadErrorInterceptor } from './upload-error.interceptor';

@Controller('upload-probe')
class UploadProbeController {
  @Post()
  @UseInterceptors(UploadErrorInterceptor, FileInterceptor('file', { limits: { fileSize: 32 } }))
  upload(@UploadedFile() file: { buffer: Buffer; size: number; originalname: string }) {
    return { size: file.size, name: file.originalname, bytes: [...file.buffer] };
  }
}

describe('Nest multipart compatibility after Multer security update', () => {
  let app: INestApplication;
  let url: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [UploadProbeController] }).compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });
  afterAll(async () => { await app.close(); });

  it('preserves file bytes and metadata', async () => {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), 'logo.png');
    const response = await fetch(url + '/upload-probe', { method: 'POST', body: form });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ size: 4, name: 'logo.png', bytes: [137, 80, 78, 71] });
  });

  it('retains upload size limits', async () => {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(33)]), 'oversize.png');
    const response = await fetch(url + '/upload-probe', { method: 'POST', body: form });
    expect(response.status).toBe(413);
    await response.text();
  });

  it('rejects an unexpected file field', async () => {
    const form = new FormData();
    form.append('unexpected', new Blob(['x']), 'test.txt');
    const response = await fetch(url + '/upload-probe', { method: 'POST', body: form });
    expect(response.status).toBe(400);
    await response.text();
  });
});
