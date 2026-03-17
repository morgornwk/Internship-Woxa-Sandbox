import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { MediaVideosService } from './media-videos.service';
import { VideoAsset, VideoAssetStatus } from './entities/video.entity';
import { AwsS3StorageService } from '../storage/aws.service';

describe('MediaVideosService', () => {
  let service: MediaVideosService;

  type VideoAssetRepoMock = {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  type AwsS3StorageServiceMock = {
    bucket: string;
    presignPut: jest.Mock;
    buildPublicUrl: jest.Mock;
    fileExists: jest.Mock;
    deleteObject: jest.Mock;
  };

  let repo: VideoAssetRepoMock;
  let aws: AwsS3StorageServiceMock;

  const makeAsset = (overrides: Partial<VideoAsset> = {}): VideoAsset =>
    ({
      id: 1,
      adminId: 'a1',
      originalFilename: 'x.mp4',
      mimeType: 'video/mp4',
      sizeBytes: '10',
      storageProvider: 's3',
      storageBucket: 'b',
      storageKey: 'videos/k',
      publicUrl: null as any,
      status: VideoAssetStatus.UPLOADING,
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
      updatedAt: new Date('2026-03-05T00:00:00.000Z'),
      ...overrides,
    }) as VideoAsset;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaVideosService,
        {
          provide: getRepositoryToken(VideoAsset),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: AwsS3StorageService,
          useValue: {
            bucket: 'bucket1',
            presignPut: jest.fn().mockResolvedValue('https://presign'),
            buildPublicUrl: jest.fn(
              (bucket: string, key: string) => `https://cdn/${bucket}/${key}`,
            ),
            fileExists: jest.fn(),
            deleteObject: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(MediaVideosService);
    repo = module.get(getRepositoryToken(VideoAsset));
    aws = module.get(AwsS3StorageService);
    jest.clearAllMocks();

    (aws.bucket as any) = 'bucket1';
  });

  describe('createPresignedUpload', () => {
    it('throws when size exceeds limit', async () => {
      await expect(
        service.createPresignedUpload(
          {
            mime_type: 'video/mp4',
            size_bytes: Number.MAX_SAFE_INTEGER,
            original_filename: 'x.mp4',
          } as any,
          'admin',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates presigned url and saves asset', async () => {
      const asset = makeAsset({
        id: 99,
        storageBucket: 'bucket1',
        storageKey: 'videos/k',
      });
      repo.create.mockImplementation((x: any) => x);
      repo.save.mockResolvedValue(asset);

      const res = await service.createPresignedUpload(
        {
          mime_type: 'video/mp4',
          size_bytes: 10,
          original_filename: 'x.mp4',
        } as any,
        'admin',
      );

      expect(aws.presignPut).toHaveBeenCalled();
      expect(res.video_id).toBe(99);
      expect(res.upload_url).toBe('https://presign');
    });
  });

  describe('confirmUpload', () => {
    it('throws when asset not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.confirmUpload(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws when file not exists', async () => {
      repo.findOne.mockResolvedValue(
        makeAsset({ id: 1, storageBucket: 'b', storageKey: 'k' }),
      );
      aws.fileExists.mockResolvedValue(false);

      await expect(service.confirmUpload(1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('marks READY when exists', async () => {
      const asset = makeAsset({ id: 1, storageBucket: 'b', storageKey: 'k' });
      repo.findOne.mockResolvedValue(asset);
      aws.fileExists.mockResolvedValue(true);
      repo.save.mockResolvedValue(asset);

      const res = await service.confirmUpload(1);
      expect(res.success).toBe(true);
      expect(asset.status).toBe(VideoAssetStatus.READY);
    });
  });

  describe('getPublicViewUrl', () => {
    it('throws when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.getPublicViewUrl(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns url', async () => {
      repo.findOne.mockResolvedValue(
        makeAsset({
          id: 1,
          storageBucket: 'b',
          storageKey: 'k',
          publicUrl: 'https://cdn/x',
        }),
      );
      const res = await service.getPublicViewUrl(1);
      expect(res.url).toBe('https://cdn/x');
    });
  });

  describe('updateVideoAsset', () => {
    it('throws when no fields', async () => {
      await expect(
        service.updateVideoAsset(1, {} as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.updateVideoAsset(1, { status: VideoAssetStatus.READY } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates and returns mapped fields', async () => {
      const asset = makeAsset({ id: 1 });
      repo.findOne.mockResolvedValue(asset);
      repo.save.mockImplementation(async (a) => a);

      const res = await service.updateVideoAsset(1, {
        status: VideoAssetStatus.READY,
        size_bytes: 123,
      } as any);
      expect(res.status).toBe(VideoAssetStatus.READY);
      expect(res.size_bytes).toBe(123);
    });
  });

  describe('deleteVideoById', () => {
    it('throws when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.deleteVideoById(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('removes and returns message', async () => {
      const asset = makeAsset({ id: 1, storageBucket: 'b', storageKey: 'k' });
      repo.findOne.mockResolvedValue(asset);
      repo.remove.mockResolvedValue(asset);
      aws.deleteObject.mockResolvedValue(undefined);

      const res = await service.deleteVideoById(1);
      expect(repo.remove).toHaveBeenCalledWith(asset);
      expect(res.message).toContain('Video deleted successfully');
    });
  });
});
