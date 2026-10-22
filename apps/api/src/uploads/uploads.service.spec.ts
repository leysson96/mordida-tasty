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
import {
  BrandLogoVariant,
  UploadedImageFile,
  UploadsService,
} from './uploads.service';

const sharpFactory = require('sharp') as typeof import('sharp').default;

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

async function brandLogoFile(width: number, height: number) {
  const buffer = await sharpFactory({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 115, g: 0, b: 6, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  return imageFile({
    originalname: 'brand.png',
    size: buffer.length,
    buffer,
  });
}

function mockCloudinaryUpload() {
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
          secure_url: 'https://res.cloudinary.com/demo/image/upload/brand.png'
        });
      });
      return uploadStream;
    }
  );
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

  it('accepts and inspects a square PNG brand logo', async () => {
    mockCloudinaryUpload();
    const file = await brandLogoFile(1200, 1200);
    const service = new UploadsService(
      configService({
        CLOUDINARY_CLOUD_NAME: 'demo',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
        UPLOAD_MAX_BYTES: 10_485_760
      })
    );

    await expect(
      service.saveBrandLogo(file, BrandLogoVariant.SQUARE)
    ).resolves.toEqual({
      url: 'https://res.cloudinary.com/demo/image/upload/brand.png',
      originalName: 'brand.png',
      mimeType: 'image/png',
      size: file.size,
      variant: BrandLogoVariant.SQUARE,
      width: 1200,
      height: 1200
    });
  });

  it('accepts a valid horizontal header logo', async () => {
    mockCloudinaryUpload();
    const file = await brandLogoFile(1600, 400);
    const service = new UploadsService(
      configService({
        CLOUDINARY_CLOUD_NAME: 'demo',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
        UPLOAD_MAX_BYTES: 10_485_760
      })
    );

    await expect(
      service.saveBrandLogo(file, BrandLogoVariant.HEADER)
    ).resolves.toEqual(expect.objectContaining({
      variant: BrandLogoVariant.HEADER,
      width: 1600,
      height: 400
    }));
  });

  it('rejects invalid brand logo dimensions before storage', async () => {
    const file = await brandLogoFile(1200, 800);
    const service = new UploadsService(
      configService({
        CLOUDINARY_CLOUD_NAME: 'demo',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
        UPLOAD_MAX_BYTES: 10_485_760
      })
    );

    await expect(
      service.saveBrandLogo(file, BrandLogoVariant.SQUARE)
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.saveBrandLogo(file, BrandLogoVariant.HEADER)
    ).rejects.toThrow(BadRequestException);
    expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
  });

  it('rejects non-PNG files from the brand logo endpoint', async () => {
    const service = new UploadsService(
      configService({ UPLOAD_MAX_BYTES: 10_485_760 })
    );

    await expect(
      service.saveBrandLogo(
        imageFile({ mimetype: 'image/jpeg' }),
        BrandLogoVariant.SQUARE
      )
    ).rejects.toThrow(BadRequestException);
  });
});
