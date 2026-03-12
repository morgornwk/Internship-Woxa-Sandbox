import { Injectable, ConflictException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AdminInvitation } from './entities/admin-invitation.entity';
import { UsersService } from '../users/users.service';
import { EmailService } from '../auth/email.service';
import { UserRole } from '@common/enums';
import { AdminListDto } from './dto/admin-list.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const INVITE_TOKEN_EXPIRY_MINUTES = 60 * 24 * 3; // 3 days
const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AdminInvitationsService {
  private readonly logger = new Logger(AdminInvitationsService.name);

  constructor(
    @InjectRepository(AdminInvitation, 'auth')
    private readonly invitationRepo: Repository<AdminInvitation>,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) { }

  async inviteAdmin(input: {
    invitedByUserId: string;
    email: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{ userId: string; status: string; emailSent: boolean }> {
    const email = input.email.trim().toLowerCase();

    const existing = await this.usersService.findByEmail(email);
    if (existing && existing.role !== UserRole.ADMIN) {
      // Allow upgrading non-admin users to admin role
      console.log(`Upgrading user from ${existing.role} to ADMIN`);
    }

    if (existing && String(existing.status ?? '').toLowerCase() === 'active' && existing.role === UserRole.ADMIN) {
      throw new ConflictException('Admin already active');
    }

    const user = existing ? await this.usersService.update(existing.id, {
      firstName: input.firstName ?? existing.firstName,
      lastName: input.lastName ?? existing.lastName,
      role: UserRole.ADMIN,
      status: 'invited',
    } as any) : await this.usersService.create({
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: UserRole.ADMIN,
      status: 'invited',
      isVerified: false,
    } as any);

    const temporaryPassword = this.generateTemporaryPassword();
    if (!existing) {
      await this.usersService.createEmailAuthAccount(user, email, temporaryPassword);
    } else {
      await this.usersService.updatePassword(user.id, temporaryPassword);
      await this.usersService.update(user.id, { status: 'invited', isVerified: false } as any);
    }

    const { tokenPlain, tokenHash, expiresAt } = await this.generateInviteToken();

    await this.invitationRepo.update({ userId: user.id, isUsed: false }, { isUsed: true });
    await this.invitationRepo.save(
      this.invitationRepo.create({
        userId: user.id,
        invitedByUserId: input.invitedByUserId,
        tokenHash,
        expiresAt,
        isUsed: false,
      }),
    );


    const emailSent = await this.emailService.sendAdminInviteEmail({
      to: email,
      inviteUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/set-password?token=${encodeURIComponent(tokenPlain)}` : '',
      temporaryPassword,
    });

    if (!emailSent) {
      this.logger.warn(`Admin invite email failed for ${email}`);
    }

    return { userId: user.id, status: 'invited', emailSent };
  }

  async acceptInvite(token: string, newPassword: string): Promise<{ message: string }> {
    const matched = await this.findInvitationByToken(token);

    const user = await this.usersService.findById(matched.userId);
    if (user.role !== UserRole.ADMIN) {
      throw new BadRequestException('Invalid invitation');
    }

    await this.usersService.updatePassword(user.id, newPassword);

    await this.usersService.update(user.id, { status: 'active', isVerified: true } as any);

    matched.isUsed = true;
    await this.invitationRepo.save(matched);

    return { message: 'Invitation accepted' };
  }

  async resendInvite(userId: string, invitedByUserId: string): Promise<{ emailSent: boolean }> {
    const user = await this.usersService.findById(userId);
    if (user.role !== UserRole.ADMIN) {
      throw new BadRequestException('User is not admin');
    }

    if (String(user.status ?? '').toLowerCase() === 'active') {
      throw new BadRequestException('Admin already active');
    }

    const temporaryPassword = this.generateTemporaryPassword();
    await this.usersService.updatePassword(user.id, temporaryPassword);

    const { tokenPlain, tokenHash, expiresAt } = await this.generateInviteToken();
    await this.invitationRepo.update({ userId: user.id, isUsed: false }, { isUsed: true });
    await this.invitationRepo.save(
      this.invitationRepo.create({
        userId: user.id,
        invitedByUserId,
        tokenHash,
        expiresAt,
        isUsed: false,
      }),
    );

    const emailSent = await this.emailService.sendAdminInviteEmail({
      to: user.email || '',
      inviteUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/set-password?token=${encodeURIComponent(tokenPlain)}` : '',
      temporaryPassword,
    });

    return { emailSent };
  }

  async listAdmins(): Promise<AdminListDto[]> {
    const users = await this.usersService.findAll();
    const admins = users.filter((u) => u.role === UserRole.ADMIN || u.role === UserRole.OWNER);

    const results: AdminListDto[] = [];

    // Use Bangkok time (UTC+7)
    const now = new Date();
    const bangkokOffset = 7 * 60 * 60 * 1000; // 7 hours in milliseconds
    const bangkokNow = new Date(now.getTime() + bangkokOffset);

    for (const u of admins) {
      let expiresAt: string | null = null;
      let hoursUntilExpiry: number | null = null;

      // หา invitation ล่าสุดของ admin (ทุกสถานะ)
      if (u.role === UserRole.ADMIN) {
        const latest = await this.invitationRepo.findOne({
          where: { userId: u.id, isUsed: false },
          order: { createdAt: 'DESC' },
        });
        console.log('latest', latest);
        
        if (latest?.expiresAt) {
          expiresAt = latest.expiresAt.toISOString();
          const bangkokExpiresAt = new Date(latest.expiresAt.getTime() + bangkokOffset);
          hoursUntilExpiry = Math.floor((bangkokExpiresAt.getTime() - bangkokNow.getTime()) / (1000 * 60 * 60));
          console.log('expiresAt', expiresAt);
          console.log('hoursUntilExpiry', hoursUntilExpiry);
          if (hoursUntilExpiry < 0) hoursUntilExpiry = 0;
        } else {
          // ถ้าไม่มี invitation pending ให้ดู invitation ล่าสุดทั้งหมด (รวมที่ใช้ไปแล้ว)
          const anyInvitation = await this.invitationRepo.findOne({
            where: { userId: u.id },
            order: { createdAt: 'DESC' },
          });
          
          if (anyInvitation?.expiresAt) {
            expiresAt = anyInvitation.expiresAt.toISOString();
            const bangkokExpiresAt = new Date(anyInvitation.expiresAt.getTime() + bangkokOffset);
            hoursUntilExpiry = Math.floor((bangkokExpiresAt.getTime() - bangkokNow.getTime()) / (1000 * 60 * 60));
            if (hoursUntilExpiry < 0) hoursUntilExpiry = 0;
          }
        }
      }

      results.push({
        id: u.id,
        email: u.email ?? null,
        firstName: (u.firstName as any) ?? null,
        lastName: (u.lastName as any) ?? null,
        status: (u.status as any) ?? null,
        role: u.role,
        expiresAt,
        hoursUntilExpiry,
      });
    }

    console.log('test :' + results)

    return results;
  }

  async suspendUser(userId: string) {
    const user = await this.usersService.findById(userId);
    if (user.role !== UserRole.ADMIN) {
      throw new BadRequestException('User is not admin');
    }

    return this.usersService.blockUser(userId);
  }

  async deleteUser(userId: string): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (user.role !== UserRole.ADMIN) {
      throw new BadRequestException('User is not admin');
    }

    await this.invitationRepo.update({ userId, isUsed: false }, { isUsed: true });
    await this.usersService.delete(userId);

    return { message: 'User deleted successfully' };
  }

  async cancelInvitationEmail(userId: string): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (user.role !== UserRole.ADMIN) {
      throw new BadRequestException('User is not admin');
    }

    const result = await this.invitationRepo.update({ userId, isUsed: false }, { isUsed: true });
    if (!result.affected) {
      throw new NotFoundException('No pending invitation found');
    }

    return { message: 'Invitation canceled successfully' };
  }

  private generateTemporaryPassword(): string {
    return crypto.randomBytes(9).toString('base64url');
  }

  private async generateInviteToken(): Promise<{ tokenPlain: string; tokenHash: string; expiresAt: Date }> {
    const tokenPlain = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(tokenPlain, BCRYPT_SALT_ROUNDS);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + INVITE_TOKEN_EXPIRY_MINUTES);
    return { tokenPlain, tokenHash, expiresAt };
  }

  private async findInvitationByToken(token: string): Promise<AdminInvitation> {
    const invitations = await this.invitationRepo.find({
      where: { isUsed: false },
    });

    for (const inv of invitations) {
      if (inv.expiresAt < new Date()) {
        continue;
      }
      const isMatch = await bcrypt.compare(token, inv.tokenHash);
      if (isMatch) {
        return inv;
      }
    }

    throw new BadRequestException('Invalid or expired invitation token');
  }
}
