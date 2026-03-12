jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

import { BadRequestException, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { AdminInvitationsService } from './admin-invitations.service';
import { AdminInvitation } from './entities/admin-invitation.entity';
import { UsersService } from '../users/users.service';
import { EmailService } from '../auth/email.service';
import { UserRole } from '@common/enums';

describe('AdminInvitationsService', () => {
  let service: AdminInvitationsService;
  let invitationRepo: jest.Mocked<Repository<AdminInvitation>>;
  let usersService: jest.Mocked<UsersService>;
  let emailService: jest.Mocked<EmailService>;
  let configService: jest.Mocked<ConfigService>;

  const fixedNow = new Date('2026-03-05T00:00:00.000Z');

  const makeUser = (overrides: Partial<any> = {}): any => ({
    id: 'user-1',
    email: 'admin@example.com',
    firstName: 'สมชาย',
    lastName: 'ใจดี',
    role: UserRole.ADMIN,
    status: 'invited',
    isVerified: false,
    createdAt: fixedNow,
    updatedAt: fixedNow,
    ...overrides,
  });

  const makeInvitation = (overrides: Partial<AdminInvitation> = {}): AdminInvitation => ({
    id: 1,
    tokenHash: 'hashed-token',
    userId: 'user-1',
    invitedByUserId: 'owner-1',
    expiresAt: new Date('2026-03-08T00:00:00.000Z'),
    isUsed: false,
    createdAt: fixedNow,
    user: makeUser(),
    ...overrides,
  });

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminInvitationsService,
        {
          provide: getRepositoryToken(AdminInvitation, 'auth'),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn((dto) => ({ id: 1, ...dto })),
            save: jest.fn(async (entity) => entity),
            update: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            createEmailAuthAccount: jest.fn(),
            updatePassword: jest.fn(),
            findAll: jest.fn(),
            blockUser: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendAdminInviteEmail: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AdminInvitationsService);
    invitationRepo = module.get(getRepositoryToken(AdminInvitation, 'auth'));
    usersService = module.get(UsersService);
    emailService = module.get(EmailService);
    configService = module.get(ConfigService);

    // Default mock returns
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-token');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (crypto.randomBytes as jest.Mock).mockReturnValue({
      toString: jest.fn().mockReturnValue('random-string'),
    });
    process.env.FRONTEND_URL = 'https://frontend.example.com';
    configService.get.mockReturnValue('https://frontend.example.com');
    emailService.sendAdminInviteEmail.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('inviteAdmin', () => {
    const inviteInput = {
      invitedByUserId: 'owner-1',
      email: 'admin@example.com',
      firstName: 'สมชาย',
      lastName: 'ใจดี',
      responsibility: 'จัดการคอร์ส',
    };

    it('upgrades non-admin existing user to admin invitation flow', async () => {
      const existingUser = makeUser({ role: UserRole.STUDENT });
      usersService.findByEmail.mockResolvedValue(existingUser);
      usersService.update.mockResolvedValue(makeUser({ role: UserRole.ADMIN }));

      const result = await service.inviteAdmin(inviteInput);

      expect(usersService.findByEmail).toHaveBeenCalledWith('admin@example.com');
      expect(usersService.update).toHaveBeenCalledWith(existingUser.id, {
        firstName: 'สมชาย',
        lastName: 'ใจดี',
        role: UserRole.ADMIN,
        status: 'invited',
      });
      expect(result).toEqual({
        userId: 'user-1',
        status: 'invited',
        emailSent: true,
      });
    });

    it('throws ConflictException when admin already active', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ status: 'active' }));

      await expect(service.inviteAdmin(inviteInput)).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates new user and invitation when email does not exist', async () => {
      const newUser = makeUser({ id: 'new-user' });
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(newUser);

      const result = await service.inviteAdmin(inviteInput);

      expect(usersService.create).toHaveBeenCalledWith({
        email: 'admin@example.com',
        firstName: 'สมชาย',
        lastName: 'ใจดี',
        role: UserRole.ADMIN,
        status: 'invited',
        isVerified: false,
      });
      expect(usersService.createEmailAuthAccount).toHaveBeenCalledWith(newUser, 'admin@example.com', 'random-string');
      expect(invitationRepo.save).toHaveBeenCalled();
      expect(emailService.sendAdminInviteEmail).toHaveBeenCalledWith({
        to: 'admin@example.com',
        inviteUrl: 'https://frontend.example.com/set-password?token=random-string',
        temporaryPassword: 'random-string',
      });
      expect(result).toEqual({
        userId: 'new-user',
        status: 'invited',
        emailSent: true,
      });
    });

    it('updates existing user and creates new invitation', async () => {
      const existingUser = makeUser({ status: 'invited' });
      usersService.findByEmail.mockResolvedValue(existingUser);
      usersService.update.mockResolvedValue(existingUser);

      const result = await service.inviteAdmin(inviteInput);

      expect(usersService.update).toHaveBeenCalledWith(existingUser.id, {
        firstName: 'สมชาย',
        lastName: 'ใจดี',
        role: UserRole.ADMIN,
        status: 'invited',
      });
      expect(usersService.updatePassword).toHaveBeenCalledWith(existingUser.id, 'random-string');
      expect(usersService.update).toHaveBeenCalledWith(existingUser.id, {
        status: 'invited',
        isVerified: false,
      });
      expect(result).toEqual({
        userId: 'user-1',
        status: 'invited',
        emailSent: true,
      });
    });

    it('invalidates previous invitations and creates new one', async () => {
      const existingUser = makeUser();
      usersService.findByEmail.mockResolvedValue(existingUser);
      usersService.update.mockResolvedValue(existingUser);

      await service.inviteAdmin(inviteInput);

      expect(invitationRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', isUsed: false },
        { isUsed: true }
      );
      expect(invitationRepo.save).toHaveBeenCalled();
    });

    it('handles email sending failure gracefully', async () => {
      const newUser = makeUser({ id: 'new-user' });
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(newUser);
      emailService.sendAdminInviteEmail.mockResolvedValue(false);

      const loggerSpy = jest.spyOn(service['logger'], 'warn');

      const result = await service.inviteAdmin(inviteInput);

      expect(loggerSpy).toHaveBeenCalledWith('Admin invite email failed for admin@example.com');
      expect(result.emailSent).toBe(false);
    });
  });

  describe('acceptInvite', () => {
    const token = 'valid-token';
    const newPassword = 'NewPassword123!';

    it('throws BadRequestException for invalid token', async () => {
      invitationRepo.find.mockResolvedValue([]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.acceptInvite(token, newPassword)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException for expired token', async () => {
      const expiredInvitation = makeInvitation({
        expiresAt: new Date('2026-03-04T00:00:00.000Z'),
      });
      invitationRepo.find.mockResolvedValue([expiredInvitation]);

      await expect(service.acceptInvite(token, newPassword)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when user is not admin', async () => {
      const invitation = makeInvitation();
      const nonAdminUser = makeUser({ role: UserRole.STUDENT });
      invitationRepo.find.mockResolvedValue([invitation]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      usersService.findById.mockResolvedValue(nonAdminUser);

      await expect(service.acceptInvite(token, newPassword)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts invitation and updates user status', async () => {
      const invitation = makeInvitation();
      const adminUser = makeUser();
      invitationRepo.find.mockResolvedValue([invitation]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      usersService.findById.mockResolvedValue(adminUser);

      const result = await service.acceptInvite(token, newPassword);

      expect(usersService.updatePassword).toHaveBeenCalledWith('user-1', newPassword);
      expect(usersService.update).toHaveBeenCalledWith('user-1', {
        status: 'active',
        isVerified: true,
      });
      expect(invitationRepo.save).toHaveBeenCalledWith({ ...invitation, isUsed: true });
      expect(result).toEqual({ message: 'Invitation accepted' });
    });
  });

  describe('resendInvite', () => {
    const userId = 'user-1';
    const invitedByUserId = 'owner-1';

    it('throws BadRequestException when user is not admin', async () => {
      const nonAdminUser = makeUser({ role: UserRole.STUDENT });
      usersService.findById.mockResolvedValue(nonAdminUser);

      await expect(service.resendInvite(userId, invitedByUserId)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when admin already active', async () => {
      const activeAdmin = makeUser({ status: 'active' });
      usersService.findById.mockResolvedValue(activeAdmin);

      await expect(service.resendInvite(userId, invitedByUserId)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('resends invitation with new token and password', async () => {
      const invitedAdmin = makeUser({ status: 'invited' });
      usersService.findById.mockResolvedValue(invitedAdmin);

      const result = await service.resendInvite(userId, invitedByUserId);

      expect(usersService.updatePassword).toHaveBeenCalledWith('user-1', 'random-string');
      expect(invitationRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', isUsed: false },
        { isUsed: true }
      );
      expect(invitationRepo.save).toHaveBeenCalled();
      expect(emailService.sendAdminInviteEmail).toHaveBeenCalledWith({
        to: 'admin@example.com',
        inviteUrl: 'https://frontend.example.com/set-password?token=random-string',
        temporaryPassword: 'random-string',
      });
      expect(result).toEqual({ emailSent: true });
    });
  });

  describe('listAdmins', () => {
    it('returns list of admins and owners with expiry info (Bangkok time)', async () => {
      const adminUser = makeUser({ role: UserRole.ADMIN, status: 'invited' });
      const ownerUser = makeUser({ id: 'owner-1', role: UserRole.OWNER, status: 'active' });
      const studentUser = makeUser({ id: 'student-1', role: UserRole.STUDENT });

      usersService.findAll.mockResolvedValue([adminUser, ownerUser, studentUser]);
      invitationRepo.findOne.mockResolvedValue(makeInvitation());

      const result = await service.listAdmins();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'user-1',
        email: 'admin@example.com',
        firstName: 'สมชาย',
        lastName: 'ใจดี',
        status: 'invited',
        role: UserRole.ADMIN,
        expiresAt: '2026-03-08T00:00:00.000Z',
        hoursUntilExpiry: 72, // Bangkok time calculation
      });
      expect(result[1]).toEqual({
        id: 'owner-1',
        email: 'admin@example.com',
        firstName: 'สมชาย',
        lastName: 'ใจดี',
        status: 'active',
        role: UserRole.OWNER,
        expiresAt: null,
        hoursUntilExpiry: null,
      });
    });

    it('returns null expiry for active admins', async () => {
      const activeAdmin = makeUser({ status: 'active' });
      usersService.findAll.mockResolvedValue([activeAdmin]);

      const result = await service.listAdmins();

      expect(result[0].expiresAt).toBeNull();
      expect(result[0].hoursUntilExpiry).toBeNull();
      expect(invitationRepo.findOne).toHaveBeenCalledTimes(2); // Once for pending, once for any invitation
    });

    it('calculates hours until expiry correctly using Bangkok time', async () => {
      const adminUser = makeUser({ role: UserRole.ADMIN, status: 'invited' });
      usersService.findAll.mockResolvedValue([adminUser]);

      // Mock invitation expiring in 24 hours (Bangkok time)
      const expiringInvitation = makeInvitation({
        expiresAt: new Date('2026-03-06T00:00:00.000Z'), // 24 hours from fixedNow in Bangkok time
      });
      invitationRepo.findOne.mockResolvedValue(expiringInvitation);

      const result = await service.listAdmins();

      expect(result[0].hoursUntilExpiry).toBe(24);
    });

    it('sets hoursUntilExpiry to 0 for expired invitations (Bangkok time)', async () => {
      const adminUser = makeUser({ role: UserRole.ADMIN, status: 'invited' });
      usersService.findAll.mockResolvedValue([adminUser]);
      
      // Mock expired invitation
      const expiredInvitation = makeInvitation({
        expiresAt: new Date('2026-03-04T00:00:00.000Z'), // 24 hours before fixedNow in Bangkok time
      });
      invitationRepo.findOne.mockResolvedValue(expiredInvitation);

      const result = await service.listAdmins();

      expect(result[0].hoursUntilExpiry).toBe(0);
    });
  });

  describe('suspendUser', () => {
    it('throws BadRequestException when user is not admin', async () => {
      usersService.findById.mockResolvedValue(makeUser({ role: UserRole.STUDENT }));

      await expect(service.suspendUser('user-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(usersService.blockUser).not.toHaveBeenCalled();
    });

    it('delegates suspension to usersService.blockUser for admin', async () => {
      const adminUser = makeUser({ role: UserRole.ADMIN });
      usersService.findById.mockResolvedValue(adminUser);
      usersService.blockUser.mockResolvedValue({ ...adminUser, status: 'suspend' } as any);

      const result = await service.suspendUser('user-1');

      expect(usersService.blockUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ ...adminUser, status: 'suspend' });
    });
  });

  describe('deleteUser', () => {
    it('throws BadRequestException when user is not admin', async () => {
      usersService.findById.mockResolvedValue(makeUser({ role: UserRole.STUDENT }));

      await expect(service.deleteUser('user-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(usersService.delete).not.toHaveBeenCalled();
    });

    it('invalidates pending invitations then deletes admin user', async () => {
      usersService.findById.mockResolvedValue(makeUser({ role: UserRole.ADMIN }));
      invitationRepo.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.deleteUser('user-1');

      expect(invitationRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', isUsed: false },
        { isUsed: true },
      );
      expect(usersService.delete).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ message: 'User deleted successfully' });
    });
  });

  describe('cancelInvitationEmail', () => {
    it('throws BadRequestException when user is not admin', async () => {
      usersService.findById.mockResolvedValue(makeUser({ role: UserRole.STUDENT }));

      await expect(service.cancelInvitationEmail('user-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when no pending invitation found', async () => {
      usersService.findById.mockResolvedValue(makeUser({ role: UserRole.ADMIN }));
      invitationRepo.update.mockResolvedValue({ affected: 0 } as any);

      await expect(service.cancelInvitationEmail('user-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('marks pending invitation as used when cancel succeeds', async () => {
      usersService.findById.mockResolvedValue(makeUser({ role: UserRole.ADMIN }));
      invitationRepo.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.cancelInvitationEmail('user-1');

      expect(invitationRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', isUsed: false },
        { isUsed: true },
      );
      expect(result).toEqual({ message: 'Invitation canceled successfully' });
    });
  });

  describe('private methods', () => {
    it('generateTemporaryPassword returns base64url string', () => {
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue('base64url-string'),
      });

      const password = (service as any).generateTemporaryPassword();

      expect(crypto.randomBytes).toHaveBeenCalledWith(9);
      expect(password).toBe('base64url-string');
    });

    it('generateInviteToken returns token, hash, and expiry', async () => {
      const tokenPlain = 'plain-token';
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue(tokenPlain),
      });

      const result = await (service as any).generateInviteToken();

      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      expect(bcrypt.hash).toHaveBeenCalledWith(tokenPlain, 10);
      expect(result.tokenPlain).toBe(tokenPlain);
      expect(result.tokenHash).toBe('hashed-token');
      expect(result.expiresAt).toEqual(new Date('2026-03-08T00:00:00.000Z'));
    });

    it('findInvitationByToken returns matching invitation', async () => {
      const invitation1 = makeInvitation({ id: 1 });
      const invitation2 = makeInvitation({ id: 2 });
      invitationRepo.find.mockResolvedValue([invitation1, invitation2]);
      
      // Reset mock before this test
      (bcrypt.compare as jest.Mock).mockClear();
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(false) // First invitation doesn't match
        .mockResolvedValueOnce(true);  // Second invitation matches

      const result = await (service as any).findInvitationByToken('valid-token');

      expect(result).toBe(invitation2);
      expect(bcrypt.compare).toHaveBeenCalledTimes(2);
    });

    it('findInvitationByToken throws for no matching token', async () => {
      invitationRepo.find.mockResolvedValue([makeInvitation()]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect((service as any).findInvitationByToken('invalid-token')).rejects.toBeInstanceOf(BadRequestException);
      expect(bcrypt.compare).toHaveBeenCalledWith('invalid-token', 'hashed-token');
    });
  });
});
