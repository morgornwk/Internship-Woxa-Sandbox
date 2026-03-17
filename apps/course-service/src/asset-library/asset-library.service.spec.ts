import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AssetLibraryService } from './asset-library.service';
import { AwsS3StorageService } from '../storage/aws.service';
import {
  AssetMedia,
  AssetMediaStatus,
  AssetMediaType,
} from './entities/asset-media.entity';

describe('AssetLibraryService', () => {
  let service: AssetLibraryService;

  type AwsS3StorageServiceMock = {
    putObject: jest.Mock;
    presignPut: jest.Mock;
    buildPublicUrl: jest.Mock;
    fileExists: jest.Mock;
    deleteObject: jest.Mock;
  };

  type AssetMediaRepoMock = {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  let aws: AwsS3StorageServiceMock;
  let repo: AssetMediaRepoMock;

  const makeAsset = (overrides: Partial<AssetMedia> = {}): AssetMedia =>
    ({
      assetMediaId: 1,
      adminId: 'a1',
      type: AssetMediaType.IMAGE,
      originalFilename: 'x.png',
      mimeType: 'image/png',
      sizeBytes: '10',
      publicUrl: 'https://cdn/x',
      status: AssetMediaStatus.READY,
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
      updatedAt: new Date('2026-03-05T00:00:00.000Z'),
      thumbnailUrl: null as any,
      durationSeconds: null as any,
      ...overrides,
    }) as AssetMedia;

  const envBackup = { ...process.env };

  beforeEach(async () => {
    process.env = { ...envBackup, AWS_S3_BUCKET: 'bucket1' };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetLibraryService,
        {
          provide: AwsS3StorageService,
          useValue: {
            putObject: jest.fn(),
            presignPut: jest.fn().mockResolvedValue('https://presign'),
            buildPublicUrl: jest.fn(
              (bucket: string, key: string) => `https://cdn/${bucket}/${key}`,
            ),
            fileExists: jest.fn(),
            deleteObject: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AssetMedia),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AssetLibraryService);
    aws = module.get(AwsS3StorageService);
    repo = module.get(getRepositoryToken(AssetMedia));
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = envBackup;
  });

  describe('uploadAssetImage', () => {
    it('throws when file missing', async () => {
      await expect(
        service.uploadAssetImage('a1', null as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when bucket env missing', async () => {
      delete process.env.AWS_S3_BUCKET;

      const file = {
        mimetype: 'image/png',
        originalname: 'x.png',
        size: 10,
        buffer: Buffer.from('x'),
      } as any;

      await expect(service.uploadAssetImage('a1', file)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws when invalid image mime', async () => {
      const file = {
        mimetype: 'text/plain',
        originalname: 'x.txt',
        size: 10,
        buffer: Buffer.from('x'),
      } as any;

      await expect(service.uploadAssetImage('a1', file)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('allows octet-stream when extension is allowed', async () => {
      const file = {
        mimetype: 'application/octet-stream',
        originalname: 'x.png',
        size: 10,
        buffer: Buffer.from('x'),
      } as any;

      repo.create.mockImplementation((x: any) => x);
      repo.save.mockResolvedValue(
        makeAsset({ assetMediaId: 99, type: AssetMediaType.IMAGE }),
      );

      await expect(service.uploadAssetImage('a1', file)).resolves.toEqual(
        expect.objectContaining({
          assetMediaId: 99,
          type: AssetMediaType.IMAGE,
        }),
      );
    });

    it('throws when image too large', async () => {
      const file = {
        mimetype: 'image/png',
        originalname: 'x.png',
        size: 30 * 1024 * 1024 + 1,
        buffer: Buffer.from('x'),
      } as any;

      await expect(service.uploadAssetImage('a1', file)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('uploads image and saves', async () => {
      const file = {
        mimetype: 'image/png',
        originalname: 'x.png',
        size: 10,
        buffer: Buffer.from('x'),
      } as any;

      repo.create.mockImplementation((x: any) => x);
      repo.save.mockResolvedValue(
        makeAsset({ assetMediaId: 99, type: AssetMediaType.IMAGE }),
      );

      const res = await service.uploadAssetImage('a1', file);

      expect(aws.putObject).toHaveBeenCalled();
      expect(res.assetMediaId).toBe(99);
      expect(res.type).toBe(AssetMediaType.IMAGE);
    });
  });

  describe('createAssetVideoPresign', () => {
    it('throws when bucket env missing', async () => {
      delete process.env.AWS_S3_BUCKET;

      await expect(
        service.createAssetVideoPresign('a1', {
          mime_type: 'video/mp4',
          size_bytes: 10,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when video mime not allowed', async () => {
      await expect(
        service.createAssetVideoPresign('a1', {
          mime_type: 'application/pdf',
          size_bytes: 10,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows empty mime when extension allowlisted', async () => {
      repo.create.mockImplementation((x: any) => x);
      repo.save.mockResolvedValue(
        makeAsset({
          assetMediaId: 88,
          type: AssetMediaType.VIDEO,
          status: AssetMediaStatus.UPLOADING,
        }),
      );

      await expect(
        service.createAssetVideoPresign('a1', {
          mime_type: '',
          size_bytes: 10,
          original_filename: 'x.mp4',
        } as any),
      ).resolves.toEqual(
        expect.objectContaining({
          assetMediaId: 88,
          type: AssetMediaType.VIDEO,
        }),
      );
    });

    it('throws when file size exceeds limit', async () => {
      await expect(
        service.createAssetVideoPresign('a1', {
          mime_type: 'video/mp4',
          size_bytes: 1024 * 1024 * 1024 + 1,
          original_filename: 'x.mp4',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates presign and saves UPLOADING asset', async () => {
      repo.create.mockImplementation((x: any) => x);
      repo.save.mockResolvedValue(
        makeAsset({
          assetMediaId: 88,
          type: AssetMediaType.VIDEO,
          status: AssetMediaStatus.UPLOADING,
        }),
      );

      const res = await service.createAssetVideoPresign('a1', {
        mime_type: 'video/mp4',
        size_bytes: 10,
        original_filename: 'x.mp4',
      } as any);

      expect(aws.presignPut).toHaveBeenCalled();
      expect(res.assetMediaId).toBe(88);
      expect(res.status).toBe(AssetMediaStatus.UPLOADING);
    });
  });

  describe('confirmAssetVideo', () => {
    it('throws when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.confirmAssetVideo(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws when status not UPLOADING', async () => {
      repo.findOne.mockResolvedValue(
        makeAsset({
          assetMediaId: 1,
          type: AssetMediaType.VIDEO,
          status: AssetMediaStatus.READY,
        }),
      );
      await expect(service.confirmAssetVideo(1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('marks READY when file exists', async () => {
      const asset = makeAsset({
        assetMediaId: 1,
        type: AssetMediaType.VIDEO,
        status: AssetMediaStatus.UPLOADING,
        publicUrl: 'https://cdn/bucket1/library-videos/k',
      });
      repo.findOne.mockResolvedValue(asset);
      aws.fileExists.mockResolvedValue(true);
      repo.save.mockResolvedValue(asset);

      const res = await service.confirmAssetVideo(1);
      expect(res.success).toBe(true);
      expect(asset.status).toBe(AssetMediaStatus.READY);
    });

    it('throws when missing publicUrl', async () => {
      repo.findOne.mockResolvedValue(
        makeAsset({
          assetMediaId: 1,
          type: AssetMediaType.VIDEO,
          status: AssetMediaStatus.UPLOADING,
          publicUrl: null as any,
        }),
      );

      await expect(service.confirmAssetVideo(1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws when file not uploaded yet', async () => {
      const asset = makeAsset({
        assetMediaId: 1,
        type: AssetMediaType.VIDEO,
        status: AssetMediaStatus.UPLOADING,
        publicUrl: 'https://cdn/bucket1/library-videos/k',
      });
      repo.findOne.mockResolvedValue(asset);
      aws.fileExists.mockResolvedValue(false);

      await expect(service.confirmAssetVideo(1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('getAssetLibraryAll', () => {
    it('throws when no assets', async () => {
      repo.find.mockResolvedValue([]);
      await expect(service.getAssetLibraryAll()).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns list', async () => {
      repo.find.mockResolvedValue([makeAsset({ assetMediaId: 1 })]);
      const res = await service.getAssetLibraryAll();
      expect(res).toHaveLength(1);
    });

    it('applies type filter when provided', async () => {
      repo.find.mockResolvedValue([
        makeAsset({ assetMediaId: 1, type: AssetMediaType.VIDEO }),
      ]);
      await service.getAssetLibraryAll(AssetMediaType.VIDEO);

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: AssetMediaType.VIDEO },
          order: { createdAt: 'DESC' },
        }),
      );
    });
  });

  describe('getAssetById', () => {
    it('throws when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.getAssetById(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns asset when found', async () => {
      repo.findOne.mockResolvedValue(makeAsset({ assetMediaId: 1 }));
      await expect(service.getAssetById(1)).resolves.toEqual(
        expect.objectContaining({ assetMediaId: 1 }),
      );
    });
  });

  describe('updateAssetImage / updateAssetVideo', () => {
    it('updateAssetImage throws when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.updateAssetImage(1, { original_filename: 'x' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updateAssetVideo throws when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.updateAssetVideo(1, { original_filename: 'x' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updateAssetImage updates fields and saves', async () => {
      const asset = makeAsset({
        assetMediaId: 1,
        type: AssetMediaType.IMAGE,
        originalFilename: 'old.png',
      });
      repo.findOne.mockResolvedValue(asset);
      repo.save.mockImplementation(async (x: any) => x);

      const updated = await service.updateAssetImage(1, {
        original_filename: 'new.png',
        public_url: 'https://cdn/new',
        status: AssetMediaStatus.READY,
      } as any);

      expect(updated.originalFilename).toBe('new.png');
      expect(updated.publicUrl).toBe('https://cdn/new');
      expect(updated.status).toBe(AssetMediaStatus.READY);
    });

    it('updateAssetVideo updates fields and saves', async () => {
      const asset = makeAsset({
        assetMediaId: 1,
        type: AssetMediaType.VIDEO,
        originalFilename: 'old.mp4',
      });
      repo.findOne.mockResolvedValue(asset);
      repo.save.mockImplementation(async (x: any) => x);

      const updated = await service.updateAssetVideo(1, {
        original_filename: 'new.mp4',
        thumbnail_url: 'https://cdn/thumb',
        duration_seconds: 12,
        status: AssetMediaStatus.READY,
      } as any);

      expect(updated.originalFilename).toBe('new.mp4');
      expect(updated.thumbnailUrl).toBe('https://cdn/thumb');
      expect(updated.durationSeconds).toBe(12);
      expect(updated.status).toBe(AssetMediaStatus.READY);
    });
  });

  describe('deleteAssetById', () => {
    it('throws when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.deleteAssetById(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws when missing publicUrl', async () => {
      repo.findOne.mockResolvedValue(
        makeAsset({ assetMediaId: 1, publicUrl: null as any }),
      );
      await expect(service.deleteAssetById(1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('deletes from s3 and deletes record', async () => {
      repo.findOne.mockResolvedValue(
        makeAsset({
          assetMediaId: 1,
          publicUrl: 'https://cdn/bucket1/library-images/k',
        }),
      );
      repo.delete.mockResolvedValue({} as any);

      const res = await service.deleteAssetById(1);

      expect(aws.deleteObject).toHaveBeenCalled();
      expect(repo.delete).toHaveBeenCalledWith({ assetMediaId: 1 });
      expect(res.message).toContain('Asset deleted successfully');
    });

    it('continues deleting record even when S3 delete fails', async () => {
      repo.findOne.mockResolvedValue(
        makeAsset({
          assetMediaId: 1,
          publicUrl: 'https://cdn/bucket1/library-images/k',
        }),
      );
      aws.deleteObject.mockRejectedValue(new Error('s3 down'));
      repo.delete.mockResolvedValue({} as any);

      const res = await service.deleteAssetById(1);

      expect(repo.delete).toHaveBeenCalledWith({ assetMediaId: 1 });
      expect(res.message).toContain('Asset deleted successfully');
    });
  });
});
