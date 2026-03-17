import { Test, TestingModule } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { [k: string]: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            googleLogin: jest.fn(),
            refreshTokens: jest.fn(),
            logout: jest.fn(),
            logoutAll: jest.fn(),
            forgotPassword: jest.fn(),
            verifyOtp: jest.fn(),
            resetPassword: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
  });

  it('register delegates to AuthService.register', async () => {
    authService.register.mockResolvedValue({ ok: true });
    await expect(controller.register({} as any)).resolves.toEqual({ ok: true });
  });

  it('login delegates to AuthService.login', async () => {
    authService.login.mockResolvedValue({ ok: true });
    await expect(controller.login({} as any)).resolves.toEqual({ ok: true });
  });

  it('refresh delegates to AuthService.refreshTokens', async () => {
    authService.refreshTokens.mockResolvedValue({ accessToken: 'a' });
    await expect(
      controller.refresh({ refreshToken: 'rt' } as any),
    ).resolves.toEqual({
      accessToken: 'a',
    });
  });

  it('logout delegates to AuthService.logout and returns message', async () => {
    authService.logout.mockResolvedValue(undefined);
    await expect(
      controller.logout('u1', { refreshToken: 'rt' } as any),
    ).resolves.toEqual({
      message: 'Logged out successfully',
    });
    expect(authService.logout).toHaveBeenCalledWith('u1', 'rt');
  });

  it('logoutAll delegates to AuthService.logoutAll and returns message', async () => {
    authService.logoutAll.mockResolvedValue(undefined);
    await expect(controller.logoutAll('u1')).resolves.toEqual({
      message: 'Logged out from all devices successfully',
    });
    expect(authService.logoutAll).toHaveBeenCalledWith('u1');
  });

  it('forgotPassword delegates to AuthService.forgotPassword', async () => {
    authService.forgotPassword.mockResolvedValue({ message: 'ok' });
    await expect(
      controller.forgotPassword({ email: 'a@b.com' } as any),
    ).resolves.toEqual({
      message: 'ok',
    });
  });

  it('verifyOtp delegates to AuthService.verifyOtp', async () => {
    authService.verifyOtp.mockResolvedValue({ resetToken: 't' });
    await expect(
      controller.verifyOtp({ email: 'a@b.com', otp: '123456' } as any),
    ).resolves.toEqual({ resetToken: 't' });
  });

  it('resetPassword delegates to AuthService.resetPassword', async () => {
    authService.resetPassword.mockResolvedValue({ message: 'done' });
    await expect(
      controller.resetPassword({ resetToken: 't', newPassword: 'p' } as any),
    ).resolves.toEqual({ message: 'done' });
  });

  it('googleCallback redirects to frontend with accessToken', async () => {
    const old = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'https://frontend.example.com';
    authService.googleLogin.mockResolvedValue({
      tokens: { accessToken: 'a b', refreshToken: 'r', expiresIn: 900 },
      user: { id: 'u1' },
    });

    const res = { redirect: jest.fn() } as any;
    await controller.googleCallback({ googleId: 'g' } as any, res);

    expect(res.redirect).toHaveBeenCalledWith(
      'https://frontend.example.com/google-callback?accessToken=a%20b',
    );

    process.env.FRONTEND_URL = old;
  });
});
