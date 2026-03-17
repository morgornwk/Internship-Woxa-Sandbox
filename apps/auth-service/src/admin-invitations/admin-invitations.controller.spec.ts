import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AdminInvitationsController } from './admin-invitations.controller';
import { AdminInvitationsService } from './admin-invitations.service';
import { InviteAdminDto } from './dto/invite-admin.dto';
import { AcceptAdminInviteDto } from './dto/accept-admin-invite.dto';

describe('AdminInvitationsController', () => {
  let controller: AdminInvitationsController;
  let service: jest.Mocked<AdminInvitationsService>;

  beforeEach(async () => {
    const mockService = {
      inviteAdmin: jest.fn(),
      acceptInvite: jest.fn(),
      resendInvite: jest.fn(),
      listAdmins: jest.fn(),
      suspendUser: jest.fn(),
      unsuspendUser: jest.fn(),
      deleteUser: jest.fn(),
      cancelInvitationEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminInvitationsController],
      providers: [
        {
          provide: AdminInvitationsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<AdminInvitationsController>(
      AdminInvitationsController,
    );
    service = module.get(AdminInvitationsService);
  });

  describe('suspendUser', () => {
    it('should delegate to service with correct parameters', async () => {
      const userId = 'user-1';
      const expectedResult = { id: userId, status: 'suspend' };

      service.suspendUser.mockResolvedValue(expectedResult as any);

      const result = await controller.suspendUser(userId);

      expect(service.suspendUser).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('unsuspendUser', () => {
    it('throws BadRequestException when user is not admin', async () => {
      service.unsuspendUser.mockRejectedValue(
        new BadRequestException('User is not admin'),
      );

      await expect(controller.unsuspendUser('user-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(service.unsuspendUser).toHaveBeenCalledWith('user-1');
    });

    it('throws BadRequestException when user is not suspended', async () => {
      service.unsuspendUser.mockRejectedValue(
        new BadRequestException('User is not suspended'),
      );

      await expect(controller.unsuspendUser('user-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(service.unsuspendUser).toHaveBeenCalledWith('user-1');
    });

    it('unsuspends admin user successfully', async () => {
      const expectedResult = {
        id: 'user-1',
        status: 'active',
        message: 'User unsuspended successfully',
      };
      service.unsuspendUser.mockResolvedValue(expectedResult);

      const result = await controller.unsuspendUser('user-1');

      expect(service.unsuspendUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('deleteUser', () => {
    it('should delegate to service with correct parameters', async () => {
      const userId = 'user-1';
      const expectedResult = { message: 'User deleted successfully' };

      service.deleteUser.mockResolvedValue(expectedResult);

      const result = await controller.deleteUser(userId);

      expect(service.deleteUser).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('cancelInvitationEmail', () => {
    it('should delegate to service with correct parameters', async () => {
      const userId = 'user-1';
      const expectedResult = { message: 'Invitation canceled successfully' };

      service.cancelInvitationEmail.mockResolvedValue(expectedResult);

      const result = await controller.cancelInvitationEmail(userId);

      expect(service.cancelInvitationEmail).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedResult);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('inviteAdmin', () => {
    it('should delegate to service with correct parameters', async () => {
      const invitedByUserId = 'owner-1';
      const dto: InviteAdminDto = {
        email: 'admin@example.com',
        firstName: 'สมชาย',
        lastName: 'ใจดี',
      };

      const expectedResult = {
        userId: 'user-1',
        status: 'invited',
        emailSent: true,
      };

      service.inviteAdmin.mockResolvedValue(expectedResult);

      const result = await controller.inviteAdmin(invitedByUserId, dto);

      expect(service.inviteAdmin).toHaveBeenCalledWith({
        invitedByUserId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
      });
      expect(result).toEqual(expectedResult);
    });

    it('should handle optional fields correctly', async () => {
      const invitedByUserId = 'owner-1';
      const dto: InviteAdminDto = {
        email: 'admin@example.com',
      };

      const expectedResult = {
        userId: 'user-1',
        status: 'invited',
        emailSent: true,
      };

      service.inviteAdmin.mockResolvedValue(expectedResult);

      const result = await controller.inviteAdmin(invitedByUserId, dto);

      expect(service.inviteAdmin).toHaveBeenCalledWith({
        invitedByUserId,
        email: dto.email,
        firstName: undefined,
        lastName: undefined,
      });
      expect(result).toEqual(expectedResult);
    });
  });

  describe('resendInvite', () => {
    it('should delegate to service with correct parameters', async () => {
      const invitedByUserId = 'owner-1';
      const userId = 'user-1';

      const expectedResult = {
        emailSent: true,
      };

      service.resendInvite.mockResolvedValue(expectedResult);

      const result = await controller.resendInvite(invitedByUserId, userId);

      expect(service.resendInvite).toHaveBeenCalledWith(
        userId,
        invitedByUserId,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('listAdmins', () => {
    it('should delegate to service and return list', async () => {
      const expectedAdmins = [
        {
          id: 'user-1',
          email: 'admin@example.com',
          firstName: 'สมชาย',
          lastName: 'ใจดี',
          role: 'ADMIN',
          status: 'invited',
          expiresAt: '2026-03-15T10:30:00.000Z',
          hoursUntilExpiry: 48,
        },
        {
          id: 'owner-1',
          email: 'owner@example.com',
          firstName: 'เจ้าของ',
          lastName: 'ระบบ',
          role: 'OWNER',
          status: 'active',
          expiresAt: null,
          hoursUntilExpiry: null,
        },
      ];

      service.listAdmins.mockResolvedValue(expectedAdmins as any);

      const result = await controller.listAdmins();

      expect(service.listAdmins).toHaveBeenCalled();
      expect(result).toEqual(expectedAdmins);
    });

    it('should return empty list when no admins exist', async () => {
      service.listAdmins.mockResolvedValue([]);

      const result = await controller.listAdmins();

      expect(service.listAdmins).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('acceptInvite', () => {
    it('should delegate to service with correct parameters', async () => {
      const dto: AcceptAdminInviteDto = {
        token: 'valid-token-123',
        newPassword: 'NewPassword123!',
      };

      const expectedResult = {
        message: 'Invitation accepted',
      };

      service.acceptInvite.mockResolvedValue(expectedResult);

      const result = await controller.acceptInvite(dto);

      expect(service.acceptInvite).toHaveBeenCalledWith(
        dto.token,
        dto.newPassword,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should handle different token formats', async () => {
      const dto: AcceptAdminInviteDto = {
        token: 'a1b2c3d4e5f6789',
        newPassword: 'AnotherPassword456!',
      };

      const expectedResult = {
        message: 'Invitation accepted',
      };

      service.acceptInvite.mockResolvedValue(expectedResult);

      const result = await controller.acceptInvite(dto);

      expect(service.acceptInvite).toHaveBeenCalledWith(
        dto.token,
        dto.newPassword,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('Controller Integration', () => {
    it('should handle complete invite flow', async () => {
      // 1. Invite admin
      const inviteDto: InviteAdminDto = {
        email: 'newadmin@example.com',
        firstName: 'ผู้ดูแล',
        lastName: 'ใหม่',
      };

      service.inviteAdmin.mockResolvedValue({
        userId: 'new-user-1',
        status: 'invited',
        emailSent: true,
      });

      const inviteResult = await controller.inviteAdmin('owner-1', inviteDto);
      expect(inviteResult.status).toBe('invited');

      // 2. List admins should show new admin
      service.listAdmins.mockResolvedValue([
        {
          id: 'new-user-1',
          email: 'newadmin@example.com',
          firstName: 'ผู้ดูแล',
          lastName: 'ใหม่',
          role: 'ADMIN',
          status: 'invited',
          responsibility: 'ทดสอบระบบ',
        },
      ] as any);

      const admins = await controller.listAdmins();
      expect(admins).toHaveLength(1);
      expect(admins[0].email).toBe('newadmin@example.com');

      // 3. Accept invitation
      const acceptDto: AcceptAdminInviteDto = {
        token: 'invitation-token',
        newPassword: 'AdminPassword789!',
      };

      service.acceptInvite.mockResolvedValue({
        message: 'Invitation accepted',
      });

      const acceptResult = await controller.acceptInvite(acceptDto);
      expect(acceptResult.message).toBe('Invitation accepted');
    });

    it('should handle resend invite flow', async () => {
      const userId = 'user-1';
      const invitedByUserId = 'owner-1';

      // Initial invite failed to send email
      service.inviteAdmin.mockResolvedValue({
        userId,
        status: 'invited',
        emailSent: false,
      });

      const inviteResult = await controller.inviteAdmin(invitedByUserId, {
        email: 'admin@example.com',
      });
      expect(inviteResult.emailSent).toBe(false);

      // Resend invite
      service.resendInvite.mockResolvedValue({
        emailSent: true,
      });

      const resendResult = await controller.resendInvite(
        invitedByUserId,
        userId,
      );
      expect(resendResult.emailSent).toBe(true);
      expect(service.resendInvite).toHaveBeenCalledWith(
        userId,
        invitedByUserId,
      );
    });
  });
});
