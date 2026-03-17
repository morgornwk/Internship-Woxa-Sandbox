import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AnnouncementsService } from './announcements.service';
import { Announcement } from './entities/announcement.entity';
import { MediaImagesService } from '../media-images/media-images.service';

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;

  type AnnouncementRepoMock = {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  type MediaImagesServiceMock = {
    uploadImageFileAndPersist: jest.Mock;
  };

  let repo: AnnouncementRepoMock;
  let mediaImages: MediaImagesServiceMock;

  const makeAnnouncement = (
    overrides: Partial<Announcement> = {},
  ): Announcement =>
    ({
      announcement_id: 1,
      title: 'A',
      imageUrl: null,
      deepLink: null,
      activeStatus: false,
      priority: 0,
      startDate: null,
      endDate: null,
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
      updatedAt: new Date('2026-03-05T00:00:00.000Z'),
      ...overrides,
    }) as Announcement;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        {
          provide: MediaImagesService,
          useValue: {
            uploadImageFileAndPersist: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Announcement),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AnnouncementsService);
    repo = module.get(getRepositoryToken(Announcement));
    mediaImages = module.get(MediaImagesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('throws on invalid deepLink', async () => {
      await expect(
        service.create({ title: 'x', deepLink: 'not-a-url' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates announcement with relative deepLink', async () => {
      const created = makeAnnouncement({ title: 'x', deepLink: '/path' });
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      const result = await service.create({
        title: 'x',
        deepLink: '/path',
      } as any);
      expect(result.title).toBe('x');
    });
  });

  describe('syncAnnouncementStatusByDate', () => {
    it('returns early when activated affected > 0', async () => {
      const qb1: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      repo.createQueryBuilder.mockReturnValue(qb1);

      await service.syncAnnouncementStatusByDate();

      expect(qb1.execute).toHaveBeenCalled();
    });

    it('continues to deactivate when activated affected = 0', async () => {
      const qbActivate: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      const qbDeactivate: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      repo.createQueryBuilder
        .mockReturnValueOnce(qbActivate)
        .mockReturnValueOnce(qbDeactivate);

      await service.syncAnnouncementStatusByDate();

      expect(qbActivate.execute).toHaveBeenCalled();
      expect(qbDeactivate.execute).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns mapped list', async () => {
      repo.find.mockResolvedValue([makeAnnouncement({ announcement_id: 1 })]);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });
  });

  describe('findActive', () => {
    it('returns mapped list from query builder', async () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([
            makeAnnouncement({ announcement_id: 1, activeStatus: true }),
          ]),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findActive();
      expect(result).toHaveLength(1);
      expect(result[0].activeStatus).toBe(true);
    });
  });

  describe('getPlaceholderImageUrl', () => {
    it('returns a non-empty url', () => {
      expect(service.getPlaceholderImageUrl()).toContain('http');
    });
  });

  describe('findOne', () => {
    it('throws when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns dto when found', async () => {
      repo.findOne.mockResolvedValue(makeAnnouncement({ announcement_id: 1 }));
      const result = await service.findOne(1);
      expect(result.announcement_id).toBe(1);
    });
  });

  describe('uploadBannerImage', () => {
    it('uploads image via MediaImagesService and updates announcement', async () => {
      const entity = makeAnnouncement({ announcement_id: 1 });
      repo.findOne.mockResolvedValue(entity);
      mediaImages.uploadImageFileAndPersist.mockResolvedValue({
        url: 'https://x',
      });
      repo.save.mockImplementation(async (a) => a);

      const file = { buffer: Buffer.from('x') } as any;
      const result = await service.uploadBannerImage(1, file, 'admin');

      expect(mediaImages.uploadImageFileAndPersist).toHaveBeenCalled();
      expect(result.imageUrl).toBe('https://x');
    });
  });

  describe('update', () => {
    it('throws on invalid deepLink', async () => {
      repo.findOne.mockResolvedValue(makeAnnouncement({ announcement_id: 1 }));
      await expect(
        service.update(1, { deepLink: 'bad' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates fields and saves', async () => {
      const entity = makeAnnouncement({ announcement_id: 1, title: 'Old' });
      repo.findOne.mockResolvedValue(entity);
      repo.save.mockImplementation(async (a) => a);

      const result = await service.update(1, {
        title: 'New',
        activeStatus: true,
      } as any);

      expect(entity.title).toBe('New');
      expect(entity.activeStatus).toBe(true);
      expect(result.title).toBe('New');
    });
  });

  describe('remove', () => {
    it('throws when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('removes and returns message', async () => {
      const entity = makeAnnouncement({ announcement_id: 1 });
      repo.findOne.mockResolvedValue(entity);
      repo.remove.mockResolvedValue(entity);

      const result = await service.remove(1);

      expect(repo.remove).toHaveBeenCalledWith(entity);
      expect(result.message).toContain('deleted successfully');
    });
  });
});
