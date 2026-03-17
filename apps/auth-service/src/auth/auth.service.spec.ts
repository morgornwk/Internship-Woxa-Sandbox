jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { LoginAttemptsService } from './login-attempts.service';
import { EmailService } from './email.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { Session } from '../users/entities/session.entity';
import { PasswordResetToken } from '../users/entities/password-reset-token.entity';
import { AuthProvider } from '@common/enums';

describe('AuthService', () => {
  let service: AuthService;

  type UsersServiceMock = {
    findByEmail: jest.Mock;
    create: jest.Mock;
    createEmailAuthAccount: jest.Mock;
    findAuthAccountByProviderAndEmail: jest.Mock;
    verifyPasswordHash: jest.Mock;
    updatePassword: jest.Mock;
    findOrCreateFromGoogle: jest.Mock;
  };

  type JwtServiceMock = {
    sign: jest.Mock;
  };

  type SessionRepoMock = {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };

  type PasswordResetTokenRepoMock = {
    update: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };

  type LoginAttemptsServiceMock = {
    getLockStatus: jest.Mock;
    recordFailure: jest.Mock;
    resetAttempts: jest.Mock;
  };

  type EmailServiceMock = {
    sendOtpEmail: jest.Mock;
    sendPasswordChangedEmail: jest.Mock;
  };

  let usersService: UsersServiceMock;
  let jwtService: JwtServiceMock;
  let sessionRepo: SessionRepoMock;
  let resetTokenRepo: PasswordResetTokenRepoMock;
  let loginAttemptsService: LoginAttemptsServiceMock;
  let emailService: EmailServiceMock;

  const fixedNow = new Date('2026-03-05T00:00:00.000Z');

  const makeUser = (overrides: Partial<User> = {}): User =>
    ({
      id: 'u1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'STUDENT' as any,
      status: 'active' as any,
      avatar: null,
      createdAt: fixedNow,
      updatedAt: fixedNow,
      sessions: [],
      authAccounts: [],
      ...overrides,
    }) as User;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
            createEmailAuthAccount: jest.fn(),
            findAuthAccountByProviderAndEmail: jest.fn(),
            verifyPasswordHash: jest.fn(),
            updatePassword: jest.fn(),
            findOrCreateFromGoogle: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Session, 'auth'),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn((dto) => ({ id: 'sid-1', ...dto })),
            save: jest.fn(async (s) => s),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PasswordResetToken, 'auth'),
          useValue: {
            update: jest.fn(),
            create: jest.fn((dto) => ({
              id: 'prt-1',
              isUsed: false,
              createdAt: fixedNow,
              ...dto,
            })),
            save: jest.fn(async (t) => t),
            find: jest.fn(),
          },
        },
        {
          provide: LoginAttemptsService,
          useValue: {
            getLockStatus: jest.fn(),
            recordFailure: jest.fn(),
            resetAttempts: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendOtpEmail: jest.fn(),
            sendPasswordChangedEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    sessionRepo = module.get(getRepositoryToken(Session, 'auth'));
    resetTokenRepo = module.get(getRepositoryToken(PasswordResetToken, 'auth'));
    loginAttemptsService = module.get(LoginAttemptsService);
    emailService = module.get(EmailService);

    jwtService.sign.mockReturnValue('access-token');

    // Note: avoid spying on crypto.randomBytes (non-configurable in some Node builds).
    (bcrypt.hash as jest.Mock).mockResolvedValue('bcrypt-hash');
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('register', () => {
    it('throws ConflictException when email already exists', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());

      await expect(
        service.register({
          email: 'TEST@Example.com ',
          firstName: 'A',
          lastName: 'B',
          password: 'pass',
        } as any),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(usersService.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('creates user, creates local auth account, and returns tokens', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const user = makeUser({
        id: 'u-register',
        email: 'test@example.com',
        firstName: 'A',
        lastName: 'B',
      });
      usersService.create.mockResolvedValue(user);

      const result = await service.register({
        email: 'TEST@Example.com ',
        firstName: ' A ',
        lastName: ' B ',
        password: 'pass',
      } as any);

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          firstName: 'A',
          lastName: 'B',
          isVerified: true,
        }),
      );
      expect(usersService.createEmailAuthAccount).toHaveBeenCalledWith(
        user,
        'test@example.com',
        'pass',
      );

      expect(result.user).toEqual(
        expect.objectContaining({
          id: 'u-register',
          email: 'test@example.com',
        }),
      );
      expect(result.tokens.accessToken).toBe('access-token');
      expect(result.tokens.refreshToken).toMatch(/^[0-9a-f]+$/);
      expect(result.tokens.expiresIn).toBe(15 * 60);
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when account is locked', async () => {
      loginAttemptsService.getLockStatus.mockResolvedValue({
        isLocked: true,
        remainingMs: 9000,
      });

      await expect(
        service.login({ email: 'a@b.com', password: 'x' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('records failure and throws invalid message when user not found', async () => {
      loginAttemptsService.getLockStatus.mockResolvedValue({ isLocked: false });
      usersService.findAuthAccountByProviderAndEmail.mockResolvedValue(null);
      loginAttemptsService.recordFailure.mockResolvedValue({ isLocked: false });

      await expect(
        service.login({ email: 'a@b.com', password: 'x' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(
        usersService.findAuthAccountByProviderAndEmail,
      ).toHaveBeenCalledWith(AuthProvider.LOCAL, 'a@b.com');
      expect(loginAttemptsService.recordFailure).toHaveBeenCalledWith(
        'a@b.com',
      );
    });

    it('records failure and throws lock message when failure causes lock', async () => {
      loginAttemptsService.getLockStatus.mockResolvedValue({ isLocked: false });
      usersService.findAuthAccountByProviderAndEmail.mockResolvedValue(null);
      loginAttemptsService.recordFailure.mockResolvedValue({
        isLocked: true,
        remainingMs: 1000,
      });

      await expect(
        service.login({ email: 'a@b.com', password: 'x' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('records failure when password invalid', async () => {
      loginAttemptsService.getLockStatus.mockResolvedValue({ isLocked: false });
      usersService.findAuthAccountByProviderAndEmail.mockResolvedValue({
        user: makeUser(),
        passwordHash: 'hash',
      });
      usersService.verifyPasswordHash.mockResolvedValue(false);
      loginAttemptsService.recordFailure.mockResolvedValue({ isLocked: false });

      await expect(
        service.login({ email: 'a@b.com', password: 'x' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(loginAttemptsService.recordFailure).toHaveBeenCalledWith(
        'a@b.com',
      );
    });

    it('throws UnauthorizedException when account inactive', async () => {
      loginAttemptsService.getLockStatus.mockResolvedValue({ isLocked: false });
      usersService.findAuthAccountByProviderAndEmail.mockResolvedValue({
        user: makeUser({ status: 'inactive' as any }),
        passwordHash: 'hash',
      });
      usersService.verifyPasswordHash.mockResolvedValue(true);

      await expect(
        service.login({ email: 'a@b.com', password: 'x' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns tokens and resets attempts on success', async () => {
      loginAttemptsService.getLockStatus.mockResolvedValue({ isLocked: false });
      const user = makeUser({ id: 'u-login' });
      usersService.findAuthAccountByProviderAndEmail.mockResolvedValue({
        user,
        passwordHash: 'hash',
      });
      usersService.verifyPasswordHash.mockResolvedValue(true);

      const result = await service.login(
        { email: 'a@b.com', password: 'x' } as any,
        'ua',
        'ip',
      );

      expect(loginAttemptsService.resetAttempts).toHaveBeenCalledWith(
        'a@b.com',
      );
      expect(result.user).toEqual(expect.objectContaining({ id: 'u-login' }));
      expect(result.tokens.accessToken).toBe('access-token');
      expect(sessionRepo.save).toHaveBeenCalled();
    });
  });

  describe('googleLogin', () => {
    it('throws UnauthorizedException when user inactive', async () => {
      usersService.findOrCreateFromGoogle.mockResolvedValue(
        makeUser({ status: 'inactive' as any }),
      );

      await expect(
        service.googleLogin({ googleId: 'g', email: 'e' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns sanitized user and tokens on success', async () => {
      usersService.findOrCreateFromGoogle.mockResolvedValue(
        makeUser({ id: 'u-google', email: 'g@example.com' }),
      );

      const result = await service.googleLogin({
        googleId: 'g',
        email: 'g@example.com',
        firstName: 'G',
      });

      expect(result.user).toEqual(
        expect.objectContaining({ id: 'u-google', email: 'g@example.com' }),
      );
      expect(result.tokens.accessToken).toBe('access-token');
    });
  });

  describe('refreshTokens', () => {
    it('throws when session not found', async () => {
      sessionRepo.findOne.mockResolvedValue(null);
      await expect(service.refreshTokens('rt')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws when refresh token expired', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'sid',
        expiresAt: new Date('2026-03-04T00:00:00.000Z'),
        revokedAt: null,
        user: makeUser(),
      });
      await expect(service.refreshTokens('rt')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('revokes all sessions and throws when token is already revoked', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'sid',
        expiresAt: new Date('2026-03-10T00:00:00.000Z'),
        revokedAt: new Date('2026-03-05T00:00:00.000Z'),
        user: makeUser({ id: 'u-revoked' }),
      });

      await expect(service.refreshTokens('rt')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(sessionRepo.update).toHaveBeenCalled();
    });

    it('rotates refresh token and returns new tokens when valid', async () => {
      const session = {
        id: 'sid',
        expiresAt: new Date('2026-03-10T00:00:00.000Z'),
        revokedAt: null as Date | null,
        user: makeUser({ id: 'u-refresh' }),
      };
      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.refreshTokens('rt');

      expect(sessionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'sid', revokedAt: expect.any(Date) }),
      );
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('logout / logoutAll', () => {
    it('logout revokes only matching session', async () => {
      await service.logout('u1', 'rt');
      expect(sessionRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1' }),
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('logoutAll revokes all active sessions for user', async () => {
      await service.logoutAll('u1');
      expect(sessionRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1' }),
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });
  });

  describe('forgotPassword', () => {
    it('returns generic message when email not found', async () => {
      usersService.findAuthAccountByProviderAndEmail.mockResolvedValue(null);

      const result = await service.forgotPassword('nope@example.com');

      expect(result).toEqual({
        message: 'If the email exists, an OTP will be sent.',
      });
      expect(resetTokenRepo.update).not.toHaveBeenCalled();
      expect(emailService.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('invalidates previous tokens, creates new OTP token, and sends email', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      usersService.findAuthAccountByProviderAndEmail.mockResolvedValue({
        user: makeUser({ id: 'u-otp', email: 'e@example.com' }),
      });

      const result = await service.forgotPassword('e@example.com');

      expect(resetTokenRepo.update).toHaveBeenCalled();
      expect(resetTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u-otp', token: 'bcrypt-hash' }),
      );
      expect(resetTokenRepo.save).toHaveBeenCalled();
      expect(emailService.sendOtpEmail).toHaveBeenCalledWith(
        'e@example.com',
        '100000',
      );
      expect(result.message).toBe('If the email exists, an OTP will be sent.');
    });
  });

  describe('verifyOtp', () => {
    it('throws BadRequestException when user not found', async () => {
      usersService.findAuthAccountByProviderAndEmail.mockResolvedValue(null);
      await expect(
        service.verifyOtp('e@example.com', '123456'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when no token matches', async () => {
      usersService.findAuthAccountByProviderAndEmail.mockResolvedValue({
        user: makeUser({ id: 'u1' }),
      });
      resetTokenRepo.find.mockResolvedValue([
        { id: 't1', token: 'hash1', userId: 'u1', isUsed: false },
      ]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.verifyOtp('e@example.com', '123456'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('replaces OTP token with reset token and returns plain reset token', async () => {
      usersService.findAuthAccountByProviderAndEmail.mockResolvedValue({
        user: makeUser({ id: 'u1' }),
      });
      const token = {
        id: 't1',
        token: 'otp-hash',
        userId: 'u1',
        isUsed: false,
        expiresAt: new Date('2026-03-05T00:09:00.000Z'),
        createdAt: fixedNow,
      };
      resetTokenRepo.find.mockResolvedValue([token]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.verifyOtp('e@example.com', '123456');

      expect(result.resetToken).toMatch(/^[0-9a-f]{64}$/);
      expect(resetTokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 't1', token: 'bcrypt-hash' }),
      );
    });
  });

  describe('resetPassword', () => {
    it('throws BadRequestException when reset token invalid', async () => {
      resetTokenRepo.find.mockResolvedValue([]);
      await expect(service.resetPassword('bad', 'new')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('updates password, marks token used, logs out all sessions, and emails user', async () => {
      const token = {
        id: 't1',
        token: 'reset-hash',
        userId: 'u1',
        isUsed: false,
        expiresAt: new Date('2026-03-05T00:09:00.000Z'),
        user: makeUser({ id: 'u1', email: 'e@example.com' }),
      };
      resetTokenRepo.find.mockResolvedValue([token]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const logoutAllSpy = jest
        .spyOn(service, 'logoutAll')
        .mockResolvedValue(undefined);

      const result = await service.resetPassword('plain-reset', 'newPass');

      expect(usersService.updatePassword).toHaveBeenCalledWith('u1', 'newPass');
      expect(resetTokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 't1', isUsed: true }),
      );
      expect(logoutAllSpy).toHaveBeenCalledWith('u1');
      expect(emailService.sendPasswordChangedEmail).toHaveBeenCalledWith(
        'e@example.com',
      );
      expect(result).toEqual({
        message: 'Password has been reset successfully',
      });
    });
  });
});
