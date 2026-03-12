import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

import { User } from './entities/user.entity';
import { AuthAccount } from './entities/auth-account.entity';
import { CreateUserDto, UpdateUserDto, UpdateRoleDto } from './dto';
import { AuthProvider } from '@common/enums';
import { UserXp } from 'apps/course-service/src/quizs/entities/user-xp.entity';
import { UserStreak } from 'apps/course-service/src/streaks/entities/user-streak.entity';
import { LessonProgress } from 'apps/course-service/src/progress/entities/progress.entity';
import { Course } from 'apps/course-service/src/courses/entities/course.entity';
import { WebsocketGateway } from '../gateway/websocket.gateway';
import { AdminInvitation } from '../admin-invitations/entities/admin-invitation.entity';
import { Status } from '@common/enums/status.enum';
import { UserRole } from '@common/enums';

@Injectable()
export class UsersService {
  private readonly s3Client: S3Client;
  private readonly logger = new Logger(UsersService.name);

  private readonly avatarOptions = [
    'https://cdn.skllracademy.com/images/16302a9b-a621-4718-9f9c-7d2e33538625',
    'https://cdn.skllracademy.com/images/3d55a1c3-7df8-4007-a8d4-e5a32b2c9819',
    'https://cdn.skllracademy.com/images/451f8c25-fb70-4b5d-bb04-258463c8cf78',
    'https://cdn.skllracademy.com/images/dadbb475-a926-4a62-b952-c4119554e0d5',
    'https://cdn.skllracademy.com/images/a07b241e-4ab4-4803-bb71-6dc1c9e2e628',
    'https://cdn.skllracademy.com/images/e172a8fd-1c6d-4d80-bd64-c27eab05f8c4',
    'https://cdn.skllracademy.com/images/6e45ebad-e177-4fef-a414-3edd7504f8d8',
    'https://cdn.skllracademy.com/images/b0a70cac-6b54-4cb0-8199-613d5af97695',
    'https://cdn.skllracademy.com/images/4627652d-52f2-4db4-88ab-48967a17f26a',
    'https://cdn.skllracademy.com/images/0eed3f5e-a06a-4413-93fd-9e3efd4953e3',
    'https://cdn.skllracademy.com/images/b5b84212-8f93-442b-9d49-fba9986a238b',
    'https://cdn.skllracademy.com/images/57bc5ecc-a8cc-4611-8d04-ad55adf56f30',
    'https://cdn.skllracademy.com/images/69427dd7-11a8-41fe-bb94-8a17f7f4e96b',
    'https://cdn.skllracademy.com/images/c86deff5-4d1e-4b1b-8a1a-2e1352a788ed',
    'https://cdn.skllracademy.com/images/a9462080-9d1b-43a1-9910-1a9bef7e3568',
  ] as const;

  private readonly defaultAvatar =
    'https://cdn.skllracademy.com/images/55de2f89-ee38-449e-8a43-22e6c9146887';

  constructor(
    @InjectRepository(User, 'auth')
    private readonly userRepo: Repository<User>,

    @InjectRepository(AuthAccount, 'auth')
    private readonly authRepo: Repository<AuthAccount>,

    @InjectRepository(Course, 'course')
    private readonly courseRepo: Repository<Course>,

    @InjectRepository(UserXp, 'course')
    private readonly userXpRepo: Repository<UserXp>,

    @InjectRepository(UserStreak, 'course')
    private readonly userStreakRepo: Repository<UserStreak>,

    @InjectRepository(LessonProgress, 'course')
    private readonly completeCourseRepo: Repository<LessonProgress>,

    @InjectRepository(AdminInvitation, 'auth')
    private readonly adminInvitationRepo: Repository<AdminInvitation>,

    private readonly websocketGateway: WebsocketGateway,

    private readonly config: ConfigService,
  ) {
    this.s3Client = this.createS3Client();
  }

  // =====================================================
  // USER CRUD
  // =====================================================

  // สร้าง user ใหม่ (ส่วนใหญ่ใช้สำหรับการลงทะเบียนผ่าน email/password หรือสร้างจาก Google profile)
  async create(dto: CreateUserDto): Promise<User> {
    if (dto.email) {
      const existing = await this.findByEmail(dto.email);
      if (existing) {
        throw new ConflictException('Email already exists');
      }
    }

    // const user = this.userRepo.create(dto);
    const user = this.userRepo.create({
      ...dto,
      isVerified: (dto as any).isVerified ?? false,
    });

    return this.userRepo.save(user);
  }

  // ค้นหา user ตาม ID (ใช้สำหรับแสดง profile หรือ admin ดูข้อมูล user)
  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ค้นหา user ตาม email (ใช้สำหรับการลงทะเบียนและล็อกอิน)
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  // Get all users (สำหรับ admin ดูรายชื่อผู้ใช้ทั้งหมด)
  async findAll() {
    const users = await this.userRepo.find();
    const onlineUsers = this.websocketGateway.getOnlineUserIds();
    const userIds = users.map((u) => u.id);

    const streaks = await this.userStreakRepo.find({
      where: { userId: In(userIds) },
    });

    const streakMap = new Map(streaks.map((s) => [s.userId, s.currentStreak]));

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      avatar: user.avatar ?? this.defaultAvatar,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      streak: streakMap.get(user.id) ?? 0,
      status: onlineUsers.has(user.id),
    }));
  }

  async ownerFindAll() {
    const users = await this.userRepo.find();
    const onlineUsers = this.websocketGateway.getOnlineUserIds();
    const userIds = users.map((u) => u.id);

    const streaks = await this.userStreakRepo.find({
      where: { userId: In(userIds) },
    });

    const streakMap = new Map(streaks.map((s) => [s.userId, s.currentStreak]));

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      avatar: user.avatar ?? this.defaultAvatar,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      streak: streakMap.get(user.id) ?? 0,
      status: user.status,
      isOnline: onlineUsers.has(user.id),
    }));
  }

  async blockUser(id: string): Promise<User> {
    const user = await this.findById(id);

    if (user.role === UserRole.OWNER) {
      throw new BadRequestException('Cannot block an OWNER user');
    }

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.STUDENT) {
      throw new BadRequestException('Can only block ADMIN or STUDENT users');
    }

    user.status = Status.SUSPEND;
    await this.userRepo.save(user);

    this.websocketGateway.disconnectUser(user.id);

    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async delete(id: string): Promise<void> {
    const result = await this.userRepo.delete(id);
    if (!result.affected) {
      throw new NotFoundException('User not found');
    }
  }

  async updateRole(id: string, dto: UpdateRoleDto): Promise<User> {
    const user = await this.findById(id);
    user.role = dto.role;
    return this.userRepo.save(user);
  }

  // =====================================================
  // AUTH ACCOUNT METHODS (AuthService ใช้ตรงนี้)
  // =====================================================

  // ค้นหา AuthAccount ตาม provider และ email (ใช้สำหรับล็อกอินด้วย email/password)
  async findAuthAccountByProviderAndEmail(
    provider: AuthProvider,
    email: string,
  ): Promise<AuthAccount | null> {
    return this.authRepo.findOne({
      where: { provider, email },
      relations: ['user'],
    });
  }

  // ค้นหา AuthAccount ตาม provider และ providerUserId (ใช้สำหรับล็อกอินด้วย Google)
  async findAuthAccountByProviderUserId(
    provider: AuthProvider,
    providerUserId: string,
  ): Promise<AuthAccount | null> {
    return this.authRepo.findOne({
      where: { provider, providerUserId },
      relations: ['user'],
    });
  }

  // สร้าง AuthAccount สำหรับ email/password (ใช้เมื่อผู้ใช้ลงทะเบียนด้วย email/password)
  async createEmailAuthAccount(
    user: User,
    email: string,
    password: string,
  ): Promise<AuthAccount> {
    const passwordHash = await argon2.hash(password);

    const account = this.authRepo.create({
      userId: user.id,
      user,
      provider: AuthProvider.LOCAL,
      email,
      passwordHash,
    });

    return this.authRepo.save(account);
  }

  // สร้างหรือค้นหา user จาก Google profile (ใช้เมื่อผู้ใช้ล็อกอินด้วย Google)
  async findOrCreateFromGoogle(profile: {
    googleId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  }): Promise<User> {
    const existingGoogle = await this.findAuthAccountByProviderUserId(
      AuthProvider.GOOGLE,
      profile.googleId,
    );

    if (existingGoogle?.user) {
      return existingGoogle.user;
    }

    let user = await this.findByEmail(profile.email);

    if (!user) {
      user = await this.create({
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatar: profile.avatar || this.defaultAvatar,
        isVerified: true,
      } as any);
    }

    await this.authRepo.save(
      this.authRepo.create({
        userId: user.id,
        user,
        provider: AuthProvider.GOOGLE,
        providerUserId: profile.googleId,
        email: profile.email,
      }),
    );

    return user;
  }

  // อัปเดตรหัสผ่าน (ใช้เมื่อผู้ใช้เปลี่ยนรหัสผ่านในโปรไฟล์)
  async updatePassword(id: string, newPassword: string) {
    let account = await this.authRepo.findOne({
      where: { userId: id, provider: AuthProvider.LOCAL },
    });

    if (!account) {
      // สร้าง local auth account ถ้าไม่มี
      account = this.authRepo.create({
        userId: id,
        provider: AuthProvider.LOCAL,
        passwordHash: await argon2.hash(newPassword),
      });
    } else {
      account.passwordHash = await argon2.hash(newPassword);
    }

    await this.authRepo.save(account);
  }

  async verifyPasswordHash(hash: string | null, password: string) {
    if (!hash) return false;
    return argon2.verify(hash, password);
  }

  // =====================================================
  // AVATAR (S3)
  // =====================================================

  getAvatarOptions(): readonly string[] {
    return this.avatarOptions;
  }

  // อัปโหลดหรืออัปเดต avatar ของผู้ใช้ (ใช้เมื่อผู้ใช้อัปโหลดรูปโปรไฟล์ใหม่)
  async uploadAvatar(id: string, file: Express.Multer.File): Promise<User> {
    // validate file
    if (!file?.buffer) {
      throw new BadRequestException('File is required');
    }

    const allowedTypes = ['image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type');
    }

    // find user
    const user = await this.findById(id);
    const oldAvatarKey = this.getAvatarKeyFromUrl(user.avatar);

    // generate new avatar to S3
    const mediaId = randomUUID();
    const key = `profile/${mediaId}`;

    // upload new avatar to S3
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.getBucket(),
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: 'public, max-age=31536000', // 1 year cache
        }),
      );
    } catch (err) {
      this.logger.error('S3 upload failed', err);
      throw new InternalServerErrorException('Failed to upload avatar');
    }

    // update database
    user.avatar = await this.getAvatarPresignedUrl(mediaId);

    await this.userRepo.save(user);

    // Delete old avatar (soft-fail)
    if (oldAvatarKey) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.getBucket(),
            Key: oldAvatarKey,
          }),
        );
      } catch (err) {
        this.logger.warn(`Failed to delete old avatar: ${oldAvatarKey}`);
      }
    }

    return user;
  }

  private getAvatarKeyFromUrl(
    avatarUrl: string | null | undefined,
  ): string | null {
    if (!avatarUrl) return null;

    //   https://<cloudfront-domain>/profile/<uuid>
    try {
      const url = new URL(avatarUrl);
      const key = url.pathname.replace(/^\/+/, '');
      return key.startsWith('profile/') ? key : null;
    } catch {
      // If the value isn't a valid URL, treat it as a raw key.
      const key = String(avatarUrl).replace(/^\/+/, '');
      return key.startsWith('profile/') ? key : null;
    }
  }

  // ดึงข้อมูลโปรไฟล์ของผู้ใช้รวมถึง XP และ streak (ใช้เมื่อแอปต้องการแสดงข้อมูลโปรไฟล์ที่ครบถ้วน)
  async getStudentProfile(userId: string) {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userXp = await this.userXpRepo.findOne({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });

    const streak = await this.userStreakRepo.findOne({
      where: { userId: userId },
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      avatarUrl: user.avatar || this.defaultAvatar,
      xp: userXp?.xpTotal || 0,
      streak: streak?.currentStreak || 0,
    };
  }

  // ดึงรายชื่อคอร์สที่ผู้ใช้เรียนจบแล้ว (ใช้เมื่อแอปต้องการแสดงคอร์สที่ผู้ใช้เรียนจบในโปรไฟล์)
  async getAllCompleteCourse(userId: string) {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const result = await this.completeCourseRepo
      .createQueryBuilder('lesson_progress')
      .leftJoin('lesson_progress.lesson', 'lesson')
      .leftJoin('lesson.chapter', 'chapter')
      .leftJoin('chapter.level', 'level')
      .leftJoin('level.course', 'course')

      .where('lesson_progress.userId = :userId', { userId })
      .andWhere('chapter.is_published = true')
      .andWhere('lesson.is_published = true')

      .select('course.course_id', 'courseId')
      .addSelect('course.course_title', 'courseTitle')
      .addSelect('course.course_imageUrl', 'courseImageUrl')
      .addSelect('course.course_description', 'courseDescription')

      .addSelect(
        `
    COUNT(DISTINCT CASE
      WHEN (
        SELECT COUNT(*) 
        FROM lessons l
        WHERE l.chapter_id = chapter.chapter_id
        AND l.is_published = true
      ) =
      (
        SELECT COUNT(*) 
        FROM progress lp2
        JOIN lessons l2 ON lp2.lesson_id = l2.lesson_id
        WHERE l2.chapter_id = chapter.chapter_id
        AND l2.is_published = true
        AND lp2.status = 'COMPLETED'
        AND lp2.user_id = :userId
      )
    THEN chapter.chapter_id
    END)
  `,
        'completedChapters',
      )

      .addSelect(
        'COUNT(DISTINCT CASE WHEN chapter.is_published = true THEN chapter.chapter_id END)',
        'totalChapters',
      )

      .addSelect(
        `
    ROUND(
      COUNT(DISTINCT CASE
        WHEN (
          SELECT COUNT(*) 
          FROM lessons l
          WHERE l.chapter_id = chapter.chapter_id
          AND l.is_published = true
        ) =
        (
          SELECT COUNT(*) 
          FROM progress lp2
          JOIN lessons l2 ON lp2.lesson_id = l2.lesson_id
          WHERE l2.chapter_id = chapter.chapter_id
          AND l2.is_published = true
          AND lp2.status = 'COMPLETED'
          AND lp2.user_id = :userId
        )
      THEN chapter.chapter_id
      END) * 100.0 /
      COUNT(DISTINCT CASE WHEN chapter.is_published = true THEN chapter.chapter_id END)
    ,2)
  `,
        'progressPercent',
      )

      .addSelect('MAX(lesson_progress.updatedAt)', 'lastProgressUpdate')

      .groupBy('course.course_id')
      .addGroupBy('course.course_title')
      .addGroupBy('course.course_imageUrl')
      .addGroupBy('course.course_description')

      .orderBy('MAX(lesson_progress.updatedAt)', 'DESC')

      .setParameter('userId', userId)

      .getRawMany();
    return result;
  }

  // ดึง URL สำหรับดาวน์โหลด avatar ของผู้ใช้ (ใช้เมื่อแอปต้องการแสดงรูปโปรไฟล์)
  async getAvatarPresignedUrl(mediaId: string) {
    const key = `profile/${mediaId}`;
    const presign_url = `https://${process.env.AWS_CLOUDFRONT_DOMAIN}/${key}`;

    // console.log('presigned URL : ', presign_url);

    return presign_url;
  }

  // =====================================================
  // S3 CLIENT FIX (แก้ type error)
  // =====================================================

  private createS3Client(): S3Client {
    const region = this.config.get<string>('AWS_REGION');
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error('Missing AWS configuration');
    }

    return new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  private getBucket(): string {
    const bucket = this.config.get<string>('AWS_S3_BUCKET');
    if (!bucket) throw new Error('AWS_S3_BUCKET missing');
    return bucket;
  }
}
