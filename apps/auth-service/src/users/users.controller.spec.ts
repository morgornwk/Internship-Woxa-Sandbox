import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: { [k: string]: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            getStudentProfile: jest.fn(),
            getAllCompleteCourse: jest.fn(),
            update: jest.fn(),
            getAvatarOptions: jest.fn(),
            uploadAvatar: jest.fn(),
            getAvatarPresignedUrl: jest.fn(),
          },
        },
        { provide: HttpService, useValue: {} },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    controller = module.get(UsersController);
    usersService = module.get(UsersService);
  });

  it('getProfile delegates to getStudentProfile', async () => {
    usersService.getStudentProfile.mockResolvedValue({ id: 'u1' });
    await expect(controller.getProfile('u1', 'Bearer t')).resolves.toEqual({
      id: 'u1',
    });
  });

  it('getAllStudentCompleteCourse delegates to getAllCompleteCourse', async () => {
    usersService.getAllCompleteCourse.mockResolvedValue({ completeCourse: [] });
    await expect(controller.getAllStudentCompleteCourse('u1')).resolves.toEqual(
      {
        completeCourse: [],
      },
    );
  });

  it('updateProfile delegates to update', async () => {
    usersService.update.mockResolvedValue({ id: 'u1' });
    await expect(
      controller.updateProfile('u1', { firstName: 'A' } as any),
    ).resolves.toEqual({
      id: 'u1',
    });
  });

  it('getAvatarOptions delegates to getAvatarOptions', async () => {
    usersService.getAvatarOptions.mockReturnValue(['a']);
    await expect(controller.getAvatarOptions()).resolves.toEqual(['a']);
  });

  it('uploadAvatar delegates to uploadAvatar', async () => {
    usersService.uploadAvatar.mockResolvedValue({ id: 'u1' });
    await expect(
      controller.uploadAvatar('u1', { buffer: Buffer.from('x') } as any),
    ).resolves.toEqual({
      id: 'u1',
    });
  });

  it('getAvatar delegates to getAvatarPresignedUrl', async () => {
    usersService.getAvatarPresignedUrl.mockResolvedValue('url');
    await expect(controller.getAvatar('m1')).resolves.toEqual({
      success: true,
      avatar_url: 'url',
    });
  });
});
