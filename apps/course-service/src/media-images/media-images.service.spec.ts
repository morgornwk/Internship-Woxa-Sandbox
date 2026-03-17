import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { MediaImagesService } from './media-images.service';
import { AwsS3StorageService } from '../storage/aws.service';
import { ImageAsset, ImageAssetStatus } from './entities/image.entity';

describe('MediaImagesService', () => {
  let service: MediaImagesService;

  type AwsS3StorageServiceMock = {
    bucket: string;
    putObject: jest.Mock;
    buildPublicUrl: jest.Mock;
    deleteObject: jest.Mock;
  };

  type ImageAssetRepoMock = {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  let aws: AwsS3StorageServiceMock;
  let repo: ImageAssetRepoMock;

  const makeAsset = (overrides: Partial<ImageAsset> = {}): ImageAsset =>
    ({
      id: 1,
      adminId: 'a1',
      originalFilename: 'x.png',
      mimeType: 'image/png',
      sizeBytes: '10',
      storageProvider: 's3',
      storageBucket: 'b',
      storageKey: 'images/k',
      publicUrl: 'https://cdn/x',
      status: ImageAssetStatus.READY,
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
      updatedAt: new Date('2026-03-05T00:00:00.000Z'),
      ...overrides,
    }) as ImageAsset;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaImagesService,
        {
          provide: AwsS3StorageService,
          useValue: {
            bucket: 'bucket1',
            putObject: jest.fn(),
            buildPublicUrl: jest.fn(
              (bucket: string, key: string) => `https://cdn/${bucket}/${key}`,
            ),
            deleteObject: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ImageAsset),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(MediaImagesService);
    aws = module.get(AwsS3StorageService);
    repo = module.get(getRepositoryToken(ImageAsset));
    jest.clearAllMocks();

    (aws.bucket as any) = 'bucket1';
  });

  describe('uploadImageFileAndPersist', () => {
    it('throws when file missing', async () => {
      await expect(
        service.uploadImageFileAndPersist(null as any, 'admin'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when invalid mime', async () => {
      const file = {
        mimetype: 'application/pdf',
        originalname: 'x.pdf',
        size: 10,
        buffer: Buffer.from('x'),
      } as any;

      await expect(
        service.uploadImageFileAndPersist(file, 'admin'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('uploads to S3 and saves asset', async () => {
      const file = {
        mimetype: 'image/png',
        originalname: 'x.png',
        size: 10,
        buffer: Buffer.from('x'),
      } as any;

      repo.create.mockImplementation((x: any) => x);
      repo.save.mockResolvedValue(
        makeAsset({ id: 99, publicUrl: 'https://cdn/bucket1/images/uuid' }),
      );

      const res = await service.uploadImageFileAndPersist(file, 'admin');

      expect(aws.putObject).toHaveBeenCalled();
      expect(res.image_id).toBe(99);
      expect(res.status).toBe(ImageAssetStatus.READY);
    });
  });

  describe('getPublicUrlById', () => {
    it('throws when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.getPublicUrlById(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('uses stored publicUrl when present', async () => {
      repo.findOne.mockResolvedValue(
        makeAsset({ id: 1, publicUrl: 'https://cdn/x' }),
      );
      const res = await service.getPublicUrlById(1);
      expect(res.url).toBe('https://cdn/x');
    });

    it('builds url when publicUrl missing', async () => {
      repo.findOne.mockResolvedValue(
        makeAsset({
          id: 1,
          publicUrl: null as any,
          storageBucket: 'b',
          storageKey: 'k',
        }),
      );
      const res = await service.getPublicUrlById(1);
      expect(aws.buildPublicUrl).toHaveBeenCalledWith('b', 'k');
      expect(res.url).toContain('https://cdn/');
    });
  });

  describe('updateImageAsset', () => {
    it('throws when no fields', async () => {
      await expect(
        service.updateImageAsset(1, {} as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.updateImageAsset(1, { original_filename: 'x.png' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates fields and saves', async () => {
      const asset = makeAsset({ id: 1, originalFilename: 'old.png' });
      repo.findOne.mockResolvedValue(asset);
      repo.save.mockImplementation(async (a) => a);

      const res = await service.updateImageAsset(1, {
        original_filename: 'new.png',
      } as any);
      expect(res.original_filename).toBe('new.png');
    });
  });

  describe('deleteImageById', () => {
    it('throws when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.deleteImageById(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deletes from S3 and removes asset', async () => {
      const asset = makeAsset({ id: 1, storageBucket: 'b', storageKey: 'k' });
      repo.findOne.mockResolvedValue(asset);
      repo.remove.mockResolvedValue(asset);

      const res = await service.deleteImageById(1);
      expect(aws.deleteObject).toHaveBeenCalledWith('b', 'k');
      expect(repo.remove).toHaveBeenCalledWith(asset);
      expect(res.deleted).toBe(true);
    });
  });
});
