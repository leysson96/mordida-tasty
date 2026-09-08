import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn()
    }
  }
}));

import { v2 as cloudinary } from 'cloudinary';
import { AppEnv } from '../config/env';
import { UploadedImageFile, UploadsService } from './uploads.service';

const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00
]);

function configService(values: Partial<AppEnv>) {
  return {
    get: jest.fn((key: keyof AppEnv) => values[key])
  } as unknown as ConfigService<AppEnv, true>;
}

function imageFile(overrides: Partial<UploadedImageFile> = {}): UploadedImageFile {
  return {
    originalname: 'burger.png',
    mimetype: 'image/png',
    size: pngBuffer.length,
    buffer: pngBuffer,
    ...overrides
  };
}

describe('UploadsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploads images to Cloudinary when credentials are configured', async () => {
    const uploadStream = { end: jest.fn() };
    const uploadStreamMock = cloudinary.uploader.upload_stream as unknown as jest.Mock;
    uploadStreamMock.mockImplementation(
      (
        _options: unknown,
        callback: (
          error: Error | undefined,
          result?: { secure_url: string }
        ) => void
      ) => {
        uploadStream.end.mockImplementation(() => {
          callback(undefined, {
            secure_url: 'https://res.cloudinary.com/demo/image/upload/mordida.jpg'
          });
        });

        return uploadStream;
      }
    );

    const service = new UploadsService(
      configService({
        CLOUDINARY_CLOUD_NAME: 'demo',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
        UPLOAD_MAX_BYTES: 5_242_880
      })
    );

    await expect(service.saveImage(imageFile())).resolves.toEqual({
      url: 'https://res.cloudinary.com/demo/image/upload/mordida.jpg',
      originalName: 'burger.png',
      mimeType: 'image/png',
      size: pngBuffer.length
    });

    expect(cloudinary.config).toHaveBeenCalledWith({
      cloud_name: 'demo',
      api_key: 'key',
      api_secret: 'secret',
      secure: true
    });
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: expect.stringMatching(/^mordida-tasty\/images\/\d{4}-\d{2}$/),
        public_id: expect.any(String),
        resource_type: 'image',
        overwrite: false
      }),
      expect.any(Function)
    );
    expect(uploadStream.end).toHaveBeenCalledWith(pngBuffer);
  });

  it('keeps rejecting files whose content does not match the image type', async () => {
    const service = new UploadsService(
      configService({
        CLOUDINARY_CLOUD_NAME: 'demo',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
        UPLOAD_MAX_BYTES: 5_242_880
      })
    );

    await expect(
      service.saveImage(imageFile({ buffer: Buffer.from('not an image') }))
    ).rejects.toThrow(BadRequestException);

    expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
  });
});
