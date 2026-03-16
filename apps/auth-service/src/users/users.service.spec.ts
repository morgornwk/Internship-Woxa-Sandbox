jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

import { BadRequestException, ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { AuthAccount } from './entities/auth-account.entity';
import { AuthProvider } from '@common/enums';
import { WebsocketGateway } from '../gateway/websocket.gateway';
import { AdminInvitation } from '../admin-invitations/entities/admin-invitation.entity';

// course entities used for injection tokens
import { Course } from 'apps/course-service/src/courses/entities/course.entity';
import { Level } from 'apps/course-service/src/levels/entities/level.entity';
import { Chapter } from 'apps/course-service/src/chapters/entities/chapter.entity';
import { LessonProgress } from 'apps/course-service/src/progress/entities/progress.entity';
import { UserStreak } from 'apps/course-service/src/streaks/entities/user-streak.entity';
import { UserXp } from 'apps/course-service/src/quizs/entities/user-xp.entity';

describe('UsersService', () => {
  let service: UsersService;

  type RepoMock = {
    findOne?: jest.Mock;
    find?: jest.Mock;
    create?: jest.Mock;
    save?: jest.Mock;
    delete?: jest.Mock;
  } & Record<string, jest.Mock>;

  let userRepo: RepoMock;
  let authRepo: RepoMock;
  let userXpRepo: RepoMock;
  let userStreakRepo: RepoMock;
  let completeCourseRepo: RepoMock & { createQueryBuilder: jest.Mock };

  const makeConfig = (map: Record<string, any>) =>
    ({
      get: jest.fn((key: string) => map[key]),
    }) as unknown as ConfigService;

  const makeUser = (overrides: Partial<User> = {}): User =>
    ({
      id: 'u1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      avatar: undefined,
      role: 'STUDENT' as any,
      status: 'active' as any,
      isVerified: false,
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
      updatedAt: new Date('2026-03-05T00:00:00.000Z'),
      sessions: [],
      authAccounts: [],
      ...overrides,
    }) as User;

  const buildModule = async (configMap?: Record<string, any>) =>
    Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User, 'auth'),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn((dto) => dto),
            save: jest.fn(async (u) => u),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuthAccount, 'auth'),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn((dto) => dto),
            save: jest.fn(async (a) => a),
          },
        },
        { provide: getRepositoryToken(Course, 'course'), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(UserXp, 'course'), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(UserStreak, 'course'), useValue: { findOne: jest.fn() } },
        {
          provide: getRepositoryToken(LessonProgress, 'course'),
          useValue: {
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        { provide: getRepositoryToken(Chapter, 'course'), useValue: {} },
        { provide: getRepositoryToken(Level, 'course'), useValue: {} },
        {
          provide: getRepositoryToken(AdminInvitation, 'auth'),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: WebsocketGateway,
          useValue: {
            getOnlineUserIds: jest.fn(() => new Set()),
          },
        },
        {
          provide: ConfigService,
          useValue: makeConfig({
            AWS_REGION: 'ap-southeast-1',
            AWS_ACCESS_KEY_ID: 'ak',
            AWS_SECRET_ACCESS_KEY: 'sk',
            AWS_S3_BUCKET: 'bucket',
            ...(configMap ?? {}),
          }),
        },
      ],
    }).compile();

  beforeEach(async () => {
    process.env.AWS_CLOUDFRONT_DOMAIN = 'cdn.example.com';
    (argon2.hash as jest.Mock).mockResolvedValue('argon-hash');
    (argon2.verify as jest.Mock).mockResolvedValue(true);

    const module: TestingModule = await buildModule();
    service = module.get(UsersService);

    userRepo = module.get(getRepositoryToken(User, 'auth')) as RepoMock;
    authRepo = module.get(getRepositoryToken(AuthAccount, 'auth')) as RepoMock;
    userXpRepo = module.get(getRepositoryToken(UserXp, 'course')) as RepoMock;
    userStreakRepo = module.get(getRepositoryToken(UserStreak, 'course')) as RepoMock;
    completeCourseRepo = module.get(getRepositoryToken(LessonProgress, 'course')) as any;

    // Initialize all mocks
    userRepo.findOne = jest.fn();
    userRepo.find = jest.fn();
    userRepo.create = jest.fn();
    userRepo.save = jest.fn();
    userRepo.delete = jest.fn();
    
    authRepo.findOne = jest.fn();
    authRepo.save = jest.fn();
    
    userXpRepo.findOne = jest.fn();
    userStreakRepo.findOne = jest.fn();
    
    completeCourseRepo.find = jest.fn();
    completeCourseRepo.createQueryBuilder = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws on missing AWS config during construction', async () => {
    await expect(buildModule({ AWS_REGION: undefined })).rejects.toThrow(
      'Missing AWS configuration',
    );
  });

  describe('create', () => {
    it('throws ConflictException when email already exists', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser());
      await expect(service.create({ email: 'test@example.com' } as any)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('creates user with default isVerified=false', async () => {
      userRepo.findOne!.mockResolvedValue(null);
      userRepo.save!.mockResolvedValue(makeUser({ isVerified: false }));

      const user = await service.create({ email: 'x@example.com' } as any);
      expect(user.isVerified).toBe(false);
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'x@example.com', isVerified: false }),
      );
    });

    it('respects explicit isVerified when provided', async () => {
      userRepo.findOne!.mockResolvedValue(null);
      userRepo.save!.mockResolvedValue(makeUser({ isVerified: true }));

      const user = await service.create({ email: 'x@example.com', isVerified: true } as any);
      expect(user.isVerified).toBe(true);
    });
  });

  describe('findById', () => {
    it('throws NotFoundException when missing', async () => {
      userRepo.findOne!.mockResolvedValue(null);
      await expect(service.findById('u1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns user when found', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser({ id: 'u1' }));
      await expect(service.findById('u1')).resolves.toEqual(expect.objectContaining({ id: 'u1' }));
    });
  });

  describe('update / delete / updateRole', () => {
    it('updates user and saves', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser({ id: 'u1', firstName: 'A' }));
      userRepo.save!.mockImplementation(async (u) => u);

      const result = await service.update('u1', { firstName: 'B' } as any);
      expect(result.firstName).toBe('B');
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('delete throws NotFoundException when affected=0', async () => {
      userRepo.delete!.mockResolvedValue({ affected: 0 });
      await expect(service.delete('u1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updateRole sets role and saves', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser({ id: 'u1', role: 'STUDENT' as any }));
      userRepo.save!.mockImplementation(async (u) => u);

      const result = await service.updateRole('u1', { role: 'ADMIN' } as any);
      expect(result.role).toBe('ADMIN');
    });
  });

  describe('auth accounts', () => {
    it('findAuthAccountByProviderAndEmail queries with relations', async () => {
      authRepo.findOne!.mockResolvedValue(null);
      await service.findAuthAccountByProviderAndEmail(AuthProvider.LOCAL, 'a@b.com');
      expect(authRepo.findOne).toHaveBeenCalledWith({
        where: { provider: AuthProvider.LOCAL, email: 'a@b.com' },
        relations: ['user'],
      });
    });

    it('createEmailAuthAccount hashes password and saves', async () => {
      const user = makeUser({ id: 'u1' });
      authRepo.save!.mockImplementation(async (a) => a);

      const account = await service.createEmailAuthAccount(user, 'a@b.com', 'pass');

      expect(argon2.hash).toHaveBeenCalledWith('pass');
      expect(account).toEqual(
        expect.objectContaining({
          userId: 'u1',
          provider: AuthProvider.LOCAL,
          email: 'a@b.com',
          passwordHash: 'argon-hash',
        }),
      );
    });

    it('verifyPasswordHash returns false on null hash', async () => {
      await expect(service.verifyPasswordHash(null, 'pass')).resolves.toBe(false);
    });
  });

  describe('findOrCreateFromGoogle', () => {
    it('returns existing Google user when found', async () => {
      authRepo.findOne!
        .mockResolvedValueOnce({ user: makeUser({ id: 'u-google' }) })
        .mockResolvedValueOnce(null);

      const user = await service.findOrCreateFromGoogle({
        googleId: 'g1',
        email: 'g@example.com',
      });

      expect(user.id).toBe('u-google');
    });

    it('creates user when missing and saves Google account', async () => {
      authRepo.findOne!
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      userRepo.findOne!.mockResolvedValue(null);
      userRepo.save!.mockResolvedValue(makeUser({ id: 'u-new', email: 'g@example.com', isVerified: true }));

      const user = await service.findOrCreateFromGoogle({
        googleId: 'g1',
        email: 'g@example.com',
        firstName: 'G',
      });

      expect(user.id).toBe('u-new');
      expect(authRepo.save).toHaveBeenCalled();
    });
  });

  describe('avatar', () => {
    it('getAvatarOptions returns predefined list', () => {
      const options = service.getAvatarOptions();
      expect(Array.isArray(options)).toBe(true);
      expect(options.length).toBeGreaterThan(0);
    });

    it('uploadAvatar throws when file missing', async () => {
      await expect(service.uploadAvatar('u1', undefined as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('uploadAvatar throws when file type invalid', async () => {
      await expect(
        service.uploadAvatar('u1', { buffer: Buffer.from('x'), mimetype: 'image/gif' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('uploadAvatar throws InternalServerErrorException when S3 upload fails', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser({ id: 'u1', avatar: undefined }));
      const s3 = (S3Client as unknown as jest.Mock).mock.results.at(-1)!.value;
      s3.send.mockRejectedValueOnce(new Error('fail'));

      await expect(
        service.uploadAvatar('u1', { buffer: Buffer.from('x'), mimetype: 'image/png' } as any),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('uploadAvatar uploads new avatar and soft-deletes old key', async () => {
      userRepo.findOne!.mockResolvedValue(
        makeUser({
          id: 'u1',
          avatar: 'https://cdn.example.com/profile/old',
        }),
      );
      userRepo.save!.mockImplementation(async (u) => u);

      const s3 = (S3Client as unknown as jest.Mock).mock.results.at(-1)!.value;
      s3.send.mockResolvedValueOnce({}).mockResolvedValueOnce({});

      const result = await service.uploadAvatar('u1', {
        buffer: Buffer.from('x'),
        mimetype: 'image/png',
      } as any);

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'bucket',
          Body: Buffer.from('x'),
          ContentType: 'image/png',
        }),
      );
      expect(DeleteObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({ Bucket: 'bucket', Key: 'profile/old' }),
      );

      expect(result.avatar).toMatch(
        /^https:\/\/cdn\.example\.com\/profile\/[0-9a-f-]+$/,
      );
    });
  });

  describe('profiles', () => {
    it('getStudentProfile returns xp/streak defaults', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser({ id: 'u1' }));
      userXpRepo.findOne!.mockResolvedValue(null);
      userStreakRepo.findOne!.mockResolvedValue(null);

      const result = await service.getStudentProfile('u1');
      expect(result).toEqual(
        expect.objectContaining({ id: 'u1', xp: 0, streak: 0 }),
      );
    });

    it('getAllCompleteCourse maps nested lesson/course fields', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser({ id: 'u1' }));
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            lesson_progress_id: 1,
            lessonId: 10,
            course_image: 'img',
            lesson: 'L1',
            lesson_description: 'D1',
            lesson_type: 'VIDEO',
            progress_percent: 100,
          },
        ]),
      };
      completeCourseRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder as any);

      const result = await service.getAllCompleteCourse('u1');
      expect(result[0]).toEqual(
        expect.objectContaining({
          lesson_progress_id: 1,
          lessonId: 10,
          course_image: 'img',
          lesson: 'L1',
          lesson_description: 'D1',
          lesson_type: 'VIDEO',
          progress_percent: 100,
        }),
      );
    });
  });
});
