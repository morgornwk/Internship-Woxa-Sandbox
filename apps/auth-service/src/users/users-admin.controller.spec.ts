import { Test, TestingModule } from '@nestjs/testing';

import { UsersAdminController } from './users-admin.controller';
import { UsersService } from './users.service';

describe('UsersAdminController', () => {
  let controller: UsersAdminController;
  let usersService: { [k: string]: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersAdminController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            updateRole: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(UsersAdminController);
    usersService = module.get(UsersService);
  });

  it('findAll delegates to usersService.findAll', async () => {
    usersService.findAll.mockResolvedValue([{ id: 'u1' }]);
    await expect(controller.findAll()).resolves.toEqual([{ id: 'u1' }]);
  });

  it('findOne delegates to usersService.findById', async () => {
    usersService.findById.mockResolvedValue({ id: 'u1' });
    await expect(controller.findOne('u1')).resolves.toEqual({ id: 'u1' });
  });

  it('updateRole delegates to usersService.updateRole', async () => {
    usersService.updateRole.mockResolvedValue({ id: 'u1', role: 'ADMIN' });
    await expect(
      controller.updateRole('u1', { role: 'ADMIN' } as any),
    ).resolves.toEqual({
      id: 'u1',
      role: 'ADMIN',
    });
  });

  it('remove delegates to usersService.delete', async () => {
    usersService.delete.mockResolvedValue(undefined);
    await expect(controller.remove('u1')).resolves.toBeUndefined();
    expect(usersService.delete).toHaveBeenCalledWith('u1');
  });
});
