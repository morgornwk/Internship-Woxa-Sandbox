import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull } from 'typeorm';

import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { Session } from '../users/entities/session.entity';
import { PasswordResetToken } from '../users/entities/password-reset-token.entity';
import { RegisterDto, LoginDto } from './dto';
import { LoginAttemptsService } from './login-attempts.service';
import { EmailService } from './email.service';
import { AuthProvider } from '@common/enums';

// เวลาเป็นนาทีสำหรับ OTP และ Reset Token
const OTP_EXPIRY_MINUTES = 10;
const RESET_TOKEN_EXPIRY_MINUTES = 15;

// จำนวนรอบของ bcrypt สำหรับ hashing
const BCRYPT_SALT_ROUNDS = 10;

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // in seconds
}

export interface AuthResponse {
  user: Partial<User>;
  tokens: TokenResponse;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(Session, 'auth')
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(PasswordResetToken, 'auth')
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    private readonly loginAttemptsService: LoginAttemptsService,
    private readonly emailService: EmailService,
  ) {}

  // Register a new user
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const email = registerDto.email.trim().toLowerCase();

    // เช็คว่ามี user ใช้ email นี้หรือยัง
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // สร้าง user (ตั้ง verified ทันทีสำหรับการลงทะเบียนผ่านฟอร์ม)
    const user = await this.usersService.create({
      firstName: registerDto.firstName.trim(),
      lastName: registerDto.lastName.trim(),
      email,
      isVerified: true,
    });

    // สร้าง local auth account
    await this.usersService.createEmailAuthAccount(
      user,
      email,
      registerDto.password,
    );

    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  // Login with email and password
  async login(
    loginDto: LoginDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AuthResponse> {
    const invalidMessage = 'Invalid email or password';

    const lockStatus = await this.loginAttemptsService.getLockStatus(
      loginDto.email,
    ); // check if account is locked
    if (lockStatus.isLocked) {
      throw new UnauthorizedException(
        this.formatLockMessage(lockStatus.remainingMs),
      );
    }

    const authAccount =
      await this.usersService.findAuthAccountByProviderAndEmail(
        AuthProvider.LOCAL,
        loginDto.email,
      );
    if (!authAccount?.user) {
      const nextStatus = await this.loginAttemptsService.recordFailure(
        loginDto.email,
      ); // login failed
      throw new UnauthorizedException(
        nextStatus.isLocked
          ? this.formatLockMessage(nextStatus.remainingMs)
          : invalidMessage,
      );
    }

    const isPasswordValid = await this.usersService.verifyPasswordHash(
      authAccount.passwordHash,
      loginDto.password,
    );
    if (!isPasswordValid) {
      const nextStatus = await this.loginAttemptsService.recordFailure(
        loginDto.email,
      );
      throw new UnauthorizedException(
        nextStatus.isLocked
          ? this.formatLockMessage(nextStatus.remainingMs)
          : invalidMessage,
      );
    }

    // check user status
    if ((authAccount.user.status ?? '').toLowerCase() !== 'active') {
      throw new UnauthorizedException('Account is inactive or suspended');
    }

    const tokens = await this.generateTokens(
      authAccount.user,
      userAgent,
      ipAddress,
    );
    await this.loginAttemptsService.resetAttempts(loginDto.email);

    return { user: this.sanitizeUser(authAccount.user), tokens };
  }

  // Google OAuth login
  async googleLogin(profile: {
    googleId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  }): Promise<AuthResponse> {
    // ค้นหาหรือสร้าง user จากข้อมูล profile ที่ได้จาก Google
    const user = await this.usersService.findOrCreateFromGoogle(profile);

    // ตรวจสอบสถานะ user
    if ((user.status ?? '').toLowerCase() !== 'active') {
      throw new UnauthorizedException('Account is inactive or suspended');
    }

    const tokens = await this.generateTokens(user);

    this.logger.log(`Google login successful for user: ${user.email}`);

    // คืนค่าในรูปแบบเดียวกับ login ปกติ
    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  // Refresh token เพื่อขอ access token + refresh token ใหม่
  async refreshTokens(refreshTokenValue: string): Promise<TokenResponse> {
    const refreshTokenHash = this.hashRefreshToken(refreshTokenValue);

    // ค้นหา session ที่ตรงกับ refresh token hash และโหลดข้อมูล user มาใช้ด้วย
    const session = await this.sessionRepository.findOne({
      where: { refreshTokenHash },
      relations: ['user'],
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // ตรวจสอบว่า refresh token หมดอายุมั้ย ถ้าหมดอายุแล้วจะไม่สามารถใช้ refresh ได้
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // ตรวจสอบว่า token นี้ถูก revoke ไปยัง
    if (session.revokedAt) {
      await this.revokeAllUserSessions(session.user.id);

      throw new UnauthorizedException(
        'Refresh token has been revoked. All sessions have been logged out.',
      );
    }

    const user = session.user;

    // ทำ Refresh Token Rotation และยกเลิก token เดิมทันที เพื่อป้องกัน replay attack
    session.revokedAt = new Date();
    await this.sessionRepository.save(session);

    return this.generateTokens(user);
  }

  // Logout from current device
  async logout(userId: string, refreshTokenValue: string): Promise<void> {
    const refreshTokenHash = this.hashRefreshToken(refreshTokenValue);

    // revoke เฉพาะ token ของ user คนนี้เท่านั้น
    await this.sessionRepository.update(
      {
        userId,
        refreshTokenHash,
        revokedAt: IsNull(),
      },
      {
        revokedAt: new Date(),
      },
    );
  }

  // Logout from all devices
  async logoutAll(userId: string): Promise<void> {
    await this.sessionRepository.update(
      {
        userId,
        revokedAt: IsNull(),
      },
      {
        revokedAt: new Date(),
      },
    );
  }

  // Forgot password - generate OTP and send email
  async forgotPassword(email: string): Promise<{ message: string }> {
    const genericMessage = 'If the email exists, an OTP will be sent.';

    const authAccount =
      await this.usersService.findAuthAccountByProviderAndEmail(
        AuthProvider.LOCAL,
        email,
      );
    if (!authAccount?.user) {
      return { message: genericMessage };
    }

    // Invalidate previous tokens
    await this.passwordResetTokenRepository.update(
      { userId: authAccount.user.id, isUsed: false },
      { isUsed: true },
    );

    // Generate OTP and hash it
    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, BCRYPT_SALT_ROUNDS);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    const resetToken = this.passwordResetTokenRepository.create({
      token: otpHash, // store hashed OTP
      userId: authAccount.user.id,
      expiresAt,
    });

    await this.passwordResetTokenRepository.save(resetToken);

    // Send plain OTP to user via email
    await this.emailService.sendOtpEmail(email, otp);

    return { message: genericMessage };
  }

  // Verify OTP using bcrypt comparison
  async verifyOtp(email: string, otp: string): Promise<{ resetToken: string }> {
    const invalidMessage = 'Invalid or expired OTP';

    const authAccount =
      await this.usersService.findAuthAccountByProviderAndEmail(
        AuthProvider.LOCAL,
        email,
      );
    if (!authAccount?.user) {
      throw new BadRequestException(invalidMessage);
    }

    // Find non-expired, unused tokens for this user
    const tokens = await this.passwordResetTokenRepository.find({
      where: {
        userId: authAccount.user.id,
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    // Compare OTP with stored hashes using bcrypt
    let matchedToken: PasswordResetToken | null = null;
    for (const token of tokens) {
      const isMatch = await bcrypt.compare(otp, token.token);
      if (isMatch) {
        matchedToken = token;
        break;
      }
    }

    if (!matchedToken) {
      throw new BadRequestException(invalidMessage);
    }

    // generate a new reset token for password reset phase
    const resetTokenPlain = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = await bcrypt.hash(
      resetTokenPlain,
      BCRYPT_SALT_ROUNDS,
    );

    // Update expiry for reset token phase
    const resetTokenExpiresAt = new Date();
    resetTokenExpiresAt.setMinutes(
      resetTokenExpiresAt.getMinutes() + RESET_TOKEN_EXPIRY_MINUTES,
    );

    // Replace OTP hash with reset token hash
    matchedToken.token = resetTokenHash;
    matchedToken.expiresAt = resetTokenExpiresAt;
    await this.passwordResetTokenRepository.save(matchedToken);

    // Return plain reset token to client
    return { resetToken: resetTokenPlain };
  }

  // Reset password with verified token
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const invalidMessage = 'Invalid or expired reset token';

    // Find all non-expired, unused tokens
    const tokens = await this.passwordResetTokenRepository.find({
      where: {
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
      relations: ['user'],
    });

    // Compare reset token with stored hashes using bcrypt
    let matchedToken: PasswordResetToken | null = null;
    for (const t of tokens) {
      const isMatch = await bcrypt.compare(token, t.token);
      if (isMatch) {
        matchedToken = t;
        break;
      }
    }

    if (!matchedToken) {
      throw new BadRequestException(invalidMessage);
    }

    // Update user password
    await this.usersService.updatePassword(matchedToken.userId, newPassword);

    // Mark the token as used
    matchedToken.isUsed = true;
    await this.passwordResetTokenRepository.save(matchedToken);

    // Logout from all sessions for security
    await this.logoutAll(matchedToken.userId);

    await this.emailService.sendPasswordChangedEmail(
      matchedToken.user.email || '',
    );
    this.logger.log(`Password reset for userId=${matchedToken.userId}`);

    return { message: 'Password has been reset successfully' };
  }

  // Generate 6-digit OTP
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Generate access and refresh tokens
  private async generateTokens(
    user: User,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<TokenResponse> {
    const role = String(user.role);
    const normalizedRole = role === 'INSTRUCTOR' ? 'ADMIN' : role;

    // สร้าง session สำหรับ refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days refresh token expiry

    const refreshTokenValue = crypto.randomBytes(48).toString('hex');
    const refreshTokenHash = this.hashRefreshToken(refreshTokenValue);
    const session = this.sessionRepository.create({
      refreshTokenHash,
      userId: user.id,
      expiresAt,
      userAgent: userAgent ?? null,
      revokedAt: null,
    });

    await this.sessionRepository.save(session);

    const payload = {
      sub: user.id,
      email: user.email,
      role: normalizedRole,
      sid: session.id,
    };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken, refreshToken: refreshTokenValue, expiresIn: 15 * 60 };
  }

  // ลบข้อมูลผู้ใช้ที่ไม่ควรเปิดเผย
  private sanitizeUser(user: User): Partial<User> {
    // แก้ให้ส่งเฉพาะ field ที่ปลอดภัย (ไม่ส่ง password, tokens, internal flags)
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      avatar: user.avatar,
      createdAt: user.createdAt,
    };
  }

  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private formatLockMessage(remainingMs: number): string {
    const secondsRemaining = Math.max(1, Math.ceil(remainingMs / 1000));
    return `Account locked. Please try again in ${secondsRemaining} seconds`;
  }

  private async revokeAllUserSessions(userId: string): Promise<void> {
    await this.sessionRepository.update(
      {
        userId,
        revokedAt: IsNull(),
      },
      {
        revokedAt: new Date(),
      },
    );
  }
}
