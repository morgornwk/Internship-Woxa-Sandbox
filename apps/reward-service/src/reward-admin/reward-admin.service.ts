import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateRewardAdminDto } from './dto/create-reward-admin.dto';
import { UpdateRewardAdminDto } from './dto/update-reward-admin.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reward } from '../reward/entities/rewards.entity';
import { randomUUID } from 'crypto';
import { AwsS3StorageService } from 'apps/course-service/src/storage/aws.service';
import { RewardStatusService } from '../reward/reward-status.service';
import { serializeReward } from '../reward/reward-response.util';
import { convertInstantToBangkokWallClock } from '../reward/reward-timestamp.util';

@Injectable()
export class RewardAdminService {
  constructor(
    private readonly aws: AwsS3StorageService,
    private readonly rewardStatusService: RewardStatusService,
    @InjectRepository(Reward, 'reward')
    private readonly rewardRepo: Repository<Reward>,
  ) {}

  async getAllReward() {
    await this.rewardStatusService.syncExpiredRewards();

    const rewards = await this.rewardRepo.find();
    return rewards.map(serializeReward);
  }

  async getRewardDetail(id: number) {
    await this.rewardStatusService.syncExpiredRewards();

    const reward = await this.rewardRepo.findOne({ where: { id } });

    if (!reward) {
      throw new NotFoundException('Reward not found');
    }

    return serializeReward(reward);
  }

  async createReward(createRewardDto: CreateRewardAdminDto, imageUrl: string) {
    const redeem_start_date = this.normalizeIncomingRewardDate(
      createRewardDto.redeem_start_date,
    );
    const redeem_end_date = this.normalizeIncomingRewardDate(
      createRewardDto.redeem_end_date,
    );

    this.ensureValidRedeemPeriod(redeem_start_date, redeem_end_date);

    const rewardCreated = this.rewardRepo.create({
      ...createRewardDto,
      redeem_start_date,
      redeem_end_date,
      image_url: imageUrl,
      remain: createRewardDto.total_limit,
      is_active: this.rewardStatusService.resolveActiveStatus(
        createRewardDto.is_active,
        redeem_end_date,
      ),
    });

    const savedReward = await this.rewardRepo.save(rewardCreated);
    return serializeReward(savedReward);
  }

  async updateReward(
    id: number,
    dto: UpdateRewardAdminDto,
    file?: Express.Multer.File,
  ) {
    await this.rewardStatusService.syncExpiredRewards();

    const reward = await this.rewardRepo.findOne({ where: { id } });

    if (!reward) {
      throw new NotFoundException('Reward not found');
    }

    let imageUrl: string | undefined;

    if (file) {
      imageUrl = await this.uploadRewardImage(file);
    }

    if (dto.total_limit !== undefined) {
      const redeemed = reward.total_limit - reward.remain;

      if (dto.total_limit < redeemed) {
        throw new BadRequestException(
          'Total limit cannot be less than already redeemed amount',
        );
      }

      reward.remain = dto.total_limit - redeemed;
      reward.total_limit = dto.total_limit;
    }

    if (imageUrl) {
      reward.image_url = imageUrl;
    }

    const normalizedRedeemStartDate =
      dto.redeem_start_date !== undefined
        ? this.normalizeIncomingRewardDate(dto.redeem_start_date)
        : undefined;
    const normalizedRedeemEndDate =
      dto.redeem_end_date !== undefined
        ? this.normalizeIncomingRewardDate(dto.redeem_end_date)
        : undefined;

    const nextRedeemStartDate =
      normalizedRedeemStartDate ?? reward.redeem_start_date;
    const nextRedeemEndDate = normalizedRedeemEndDate ?? reward.redeem_end_date;

    this.ensureValidRedeemPeriod(nextRedeemStartDate, nextRedeemEndDate);

    Object.assign(reward, {
      ...dto,
      ...(normalizedRedeemStartDate !== undefined
        ? { redeem_start_date: normalizedRedeemStartDate }
        : {}),
      ...(normalizedRedeemEndDate !== undefined
        ? { redeem_end_date: normalizedRedeemEndDate }
        : {}),
    });
    reward.is_active = this.rewardStatusService.resolveActiveStatus(
      dto.is_active ?? reward.is_active,
      nextRedeemEndDate,
    );

    const savedReward = await this.rewardRepo.save(reward);
    return serializeReward(savedReward);
  }

  async removeRewardById(id: number) {
    const reward = await this.rewardRepo.findOne({ where: { id } });

    if (reward === null || reward === undefined) {
      throw new NotFoundException('Reward not found');
    }

    if (reward.is_active) {
      reward.is_active = false;
    }
    await this.rewardRepo.save(reward);
    await this.rewardRepo.softDelete(id);

    return {
      message: 'Deleted reward success',
    };
  }

  private ensureValidRedeemPeriod(
    startDate: Date | string,
    endDate: Date | string,
  ) {
    if (new Date(endDate) <= new Date(startDate)) {
      throw new BadRequestException(
        'Redeem end date must be greater than start date',
      );
    }
  }

  private normalizeIncomingRewardDate(value: Date | string): Date {
    if (value instanceof Date) {
      return convertInstantToBangkokWallClock(value);
    }

    const raw = value.trim();
    const wallClockMatch = raw.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/,
    );

    if (wallClockMatch) {
      const [
        ,
        year,
        month,
        day,
        hour,
        minute,
        second = '00',
        milliseconds = '0',
      ] = wallClockMatch;
      const normalizedMilliseconds = milliseconds.padEnd(3, '0');

      return new Date(
        Date.UTC(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hour),
          Number(minute),
          Number(second),
          Number(normalizedMilliseconds),
        ),
      );
    }

    const parsed = new Date(raw);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid reward date');
    }

    return convertInstantToBangkokWallClock(parsed);
  }

  // ตรวจสอบ MIME type ของไฟล์ภาพที่อัพโหลดเข้ามา (รองรับ jpg/jpeg/png/webp)
  private validateImageMime(mime: string, originalName?: string) {
    const ext = (originalName ?? '').split('.').pop()?.toLowerCase();
    const allowMime = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/pjpeg',
      'image/webp',
    ];
    const allowExt = ['jpg', 'jpeg', 'png', 'webp'];

    if (allowMime.includes((mime ?? '').toLowerCase())) return;
    if (
      (mime === 'application/octet-stream' || !mime) &&
      ext &&
      allowExt.includes(ext)
    )
      return;

    throw new BadRequestException('invalid image mime type');
  }

  //Upload reward image to AWS and get url
  async uploadRewardImage(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('file missing');

    this.validateImageMime(file.mimetype, file.originalname);

    const maxSize = Number(process.env.IMAGE_MAX_SIZE_BYTES ?? 5 * 1024 * 1024);
    if (file.size > maxSize) {
      throw new BadRequestException('file too large');
    }

    const bucket = this.aws.bucket;

    // สร้าง storage key แบบ unique (คุณสามารถเปลี่ยน structure ได้)
    const uuid = randomUUID();
    const storageKey = `rewards/${uuid}`;

    // อัพโหลดไฟล์ไปยัง storage provider s3 หรือตามที่คุณตั้งค่าไว้
    await this.aws.putObject(
      bucket,
      storageKey,
      file.buffer,
      file.size,
      file.mimetype,
    );

    // สร้าง URL สาธารณะสำหรับเข้าถึงไฟล์ผ่าน CloudFront หรือ storage provider อื่น
    const publicUrl = this.aws.buildPublicUrl(bucket, storageKey);

    return publicUrl;
  }
}
