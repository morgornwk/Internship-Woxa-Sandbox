import { Injectable, ConflictException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AdminInvitation } from './entities/admin-invitation.entity';
import { UsersService } from '../users/users.service';
import { EmailService } from '../auth/email.service';
import { UserRole } from '@common/enums';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

/**
 * Admin Invitations Service
 * 
 * บริการจัดการการเชิญผู้ดูแลระบบ (Admin) โดยเจ้าของระบบ (OWNER)
 * 
 * หน้าที่หลัก:
 * - สร้างและจัดการ invitation tokens
 * - ส่งอีเมลเชิญพร้อม temporary password
 * - ตรวจสอบและยืนยันการเชิญ
 * - จัดการสถานะของ admin users (invited -> active)
 * 
 * Security:
 * - Tokens ถูก hash ก่อนเก็บในฐานข้อมูล
 * - Temporary passwords ถูก hash ก่อนเก็บ
 * - Tokens มีอายุ 24 ชั่วโมงและใช้ได้ครั้งเดียว
 * - เฉพาะ OWNER ที่สามารถเชิญและจัดการ admin ได้
 */
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

  /**
   * เชิญผู้ดูแลระบบ (Admin) ใหม่
   * 
   * ขั้นตอนการทำงาน:
   * 1. ตรวจสอบว่าอีเมลไม่ซ้ำหรือเป็น admin ที่ยังไม่ active
   * 2. สร้าง/อัพเดต user ให้มี role=ADMIN และ status='invited'
   * 3. สร้าง temporary password และบันทึก (hash)
   * 4. สร้าง invitation token (hash) พร้อม expiry 3 วัน
   * 5. ส่งอีเมลเชิญพร้อม link และ temporary password
   * 
   * @param input ข้อมูลการเชิญ (email, ชื่อ, ความรับผิดชอบ)
   * @returns { userId, status, emailSent } ผลการดำเนินการ
   */
  async inviteAdmin(input: {
    invitedByUserId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    responsibility?: string;
  }): Promise<{ userId: string; status: string; emailSent: boolean }>
  {
    const email = input.email.trim().toLowerCase();

    const existing = await this.usersService.findByEmail(email);
    if (existing && existing.role !== UserRole.ADMIN) {
      // Allow upgrading non-admin users to admin role
      console.log(`Upgrading user from ${existing.role} to ADMIN`);
    }

    if (existing && String(existing.status ?? '').toLowerCase() === 'active' && existing.role === UserRole.ADMIN) {
      throw new ConflictException('Admin already active');
    }

    const user = existing
      ? await this.usersService.update(existing.id, {
        firstName: input.firstName ?? existing.firstName,
        lastName: input.lastName ?? existing.lastName,
        role: UserRole.ADMIN,  // 👉 เปลี่ยน role เป็น ADMIN
        status: 'invited',     // 👉 เปลี่ยน status เป็น invited
      } as any)
      : await this.usersService.create({
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
        responsibility: input.responsibility ?? null,
        expiresAt,
        isUsed: false,
      }),
    );

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? '';
    const acceptUrl = frontendUrl ? `${frontendUrl}/accept-admin-invite?token=${encodeURIComponent(tokenPlain)}` : '';

    const emailSent = await this.emailService.sendAdminInviteEmail({
      to: email,
      inviteUrl: acceptUrl,
      responsibility: input.responsibility,
      temporaryPassword,
    });

    if (!emailSent) {
      this.logger.warn(`Admin invite email failed for ${email}`);
    }

    return { userId: user.id, status: 'invited', emailSent };
  }

  /**
   * ยอมรับการเชิญและตั้งรหัสผ่านใหม่
   * 
   * ขั้นตอนการทำงาน:
   * 1. ตรวจสอบ token ว่าถูกต้องและไม่หมดอายุ
   * 2. ยืนยันว่า user เป็น ADMIN และมี status='invited'
   * 3. อัพเดตรหัสผ่านใหม่ (hash)
   * 4. เปลี่ยนสถานะ user เป็น 'active' และ verified=true
   * 5. ทำเครื่องหมาย token ว่าใช้แล้ว
   * 
   * @param token Invitation token ที่ได้รับจากอีเมล
   * @param newPassword รหัสผ่านใหม่ที่ตั้งโดย admin
   * @returns { message } ข้อความยืนยันการเชิญ
   */
  async acceptInvite(token: string, newPassword: string): Promise<{ message: string }>
  {
    const matched = await this.findInvitationByToken(token);

    const user = await this.usersService.findById(matched.userId);
    if (user.role !== UserRole.ADMIN) {
      throw new BadRequestException('Invalid invitation');
    }

    await this.usersService.updatePassword(user.id, newPassword);

    await this.usersService.update(user.id, {
      status: 'active',
      isVerified: true,
    } as any);

    matched.isUsed = true;
    await this.invitationRepo.save(matched);

    return { message: 'Invitation accepted' };
  }

  /**
   * ส่งอีเมลเชิญซ้ำสำหรับ admin ที่ยังไม่ได้ยอมรับ
   * 
   * ขั้นตอนการทำงาน:
   * 1. ตรวจสอบว่า user เป็น ADMIN และยังไม่ active
   * 2. สร้าง temporary password ใหม่
   * 3. สร้าง invitation token ใหม่ (invalidate token เก่า)
   * 4. ส่งอีเมลเชิญใหม่พร้อม temporary password
   * 
   * @param userId ID ของ admin ที่ต้องการส่งเชิญซ้ำ
   * @param invitedByUserId ID ของผู้ที่ส่งเชิญ (ต้องเป็น OWNER)
   * @returns { emailSent } สถานะการส่งอีเมล
   */
  async resendInvite(userId: string, invitedByUserId: string): Promise<{ emailSent: boolean }>
  {
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
        responsibility: null,
        expiresAt,
        isUsed: false,
      }),
    );

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? '';
    const acceptUrl = frontendUrl ? `${frontendUrl}/accept-admin-invite?token=${encodeURIComponent(tokenPlain)}` : '';

    const emailSent = await this.emailService.sendAdminInviteEmail({
      to: user.email || '',
      inviteUrl: acceptUrl,
      temporaryPassword,
    });

    return { emailSent };
  }

  /**
   * ดึงรายชื่อ admin ทั้งหมดพร้อมสถานะ
   * 
   * ข้อมูลที่ส่งกลับ:
   * - ข้อมูลพื้นฐานของ admin (id, email, ชื่อ, role, status)
   * - ความรับผิดชอบ (responsibility) สำหรับ admin ที่ยังเป็น 'invited'
   * 
   * @returns รายการ admin ทั้งหมดในระบบ
   */
  async listAdmins(): Promise<
    Array<{
      id: string;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
      status: string | null;
      role: UserRole;
      responsibility: string | null;
    }>
  > {
    const users = await this.usersService.findAll();
    const admins = users.filter((u) => u.role === UserRole.ADMIN || u.role === UserRole.OWNER);

    const results: Array<{
      id: string;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
      status: string | null;
      role: UserRole;
      responsibility: string | null;
    }> = [];

    for (const u of admins) {
      let responsibility: string | null = null;

      if (u.role === UserRole.ADMIN && String(u.status ?? '').toLowerCase() === 'invited') {
        const latest = await this.invitationRepo.findOne({
          where: { userId: u.id, isUsed: false },
          order: { createdAt: 'DESC' },
        });
        responsibility = latest?.responsibility ?? null;
      }

      results.push({
        id: u.id,
        email: u.email ?? null,
        firstName: (u.firstName as any) ?? null,
        lastName: (u.lastName as any) ?? null,
        status: (u.status as any) ?? null,
        role: u.role,
        responsibility,
      });
    }

    return results;
  }

  /**
   * สร้างรหัสผ่านชั่วคราว (9 bytes base64url)
   * 
   * @returns temporary password ที่ยังไม่ได้ hash
   */
  private generateTemporaryPassword(): string {
    return crypto.randomBytes(9).toString('base64url');
  }

  /**
   * สร้าง invitation token พร้อม hash และ expiry
   * 
   * @returns { tokenPlain, tokenHash, expiresAt } token ดิบ, token ที่ hash, และวันหมดอายุ
   */
  private async generateInviteToken(): Promise<{ tokenPlain: string; tokenHash: string; expiresAt: Date }> {
    const tokenPlain = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(tokenPlain, BCRYPT_SALT_ROUNDS);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + INVITE_TOKEN_EXPIRY_MINUTES);
    return { tokenPlain, tokenHash, expiresAt };
  }

  /**
   * ค้นหา invitation จาก token ที่ยังไม่ใช้และไม่หมดอายุ
   * 
   * @param token Token ดิบที่ได้รับจากอีเมล
   * @returns AdminInvitation ที่ตรงกัน
   * @throws BadRequestException ถ้า token ไม่ถูกต้อง หมดอายุ หรือใช้แล้ว
   */
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
