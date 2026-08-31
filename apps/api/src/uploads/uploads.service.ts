import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { AppEnv } from '../config/env';

const imageExtensions = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

export interface UploadedImageFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class UploadsService {
  constructor(private readonly configService: ConfigService<AppEnv, true>) {}

  async saveImage(file?: UploadedImageFile) {
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }

    const extension = imageExtensions.get(file.mimetype);
    if (!extension) {
      throw new BadRequestException('Only JPG, PNG and WEBP images are allowed.');
    }

    const maxBytes = this.configService.get('UPLOAD_MAX_BYTES', { infer: true });
    if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
      throw new BadRequestException('Upload limit is misconfigured.');
    }

    if (file.size > maxBytes) {
      throw new BadRequestException(`Image cannot exceed ${Math.floor(maxBytes / 1_048_576)} MB.`);
    }

    if (!this.matchesImageSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException('Image content does not match the file type.');
    }

    const bucket = new Date().toISOString().slice(0, 7);
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const root = this.uploadRoot();
    const directory = join(root, 'images', bucket);
    const diskPath = join(directory, filename);

    await mkdir(directory, { recursive: true });
    await writeFile(diskPath, file.buffer);

    const apiUrl = this.configService.get('API_PUBLIC_URL', { infer: true }).replace(/\/+$/, '');

    return {
      url: `${apiUrl}/uploads/images/${bucket}/${filename}`,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size
    };
  }

  private uploadRoot() {
    const configured = this.configService.get('UPLOAD_DIR', { infer: true });
    return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }

  private matchesImageSignature(buffer: Buffer, mimeType: string) {
    if (mimeType === 'image/jpeg') {
      return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }

    if (mimeType === 'image/png') {
      return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }

    if (mimeType === 'image/webp') {
      return (
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    }

    return false;
  }
}
