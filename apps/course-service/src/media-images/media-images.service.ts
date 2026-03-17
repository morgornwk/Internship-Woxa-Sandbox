import { InjectRepository } from '@nestjs/typeorm';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { AwsS3StorageService } from '../storage/aws.service';
import { ImageAsset, ImageAssetStatus } from './entities/image.entity';
import { UpdateImageDto } from './dto/update-image.dto';

@Injectable()
export class MediaImagesService {
  constructor(
    private readonly aws: AwsS3StorageService,
    @InjectRepository(ImageAsset)
    private readonly repo: Repository<ImageAsset>,
  ) {}

  // ตรวจสอบ MIME type ของไฟล์ภาพที่อัพโหลดเข้ามา (รองรับ jpg/jpeg/png/webp)
  private validateImageMime(mime: string, originalName?: string) {
    const ext = (originalName ?? '').split('.').pop()?.toLowerCase();
    const allowMime = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/pjpeg',
      'image/webp',
      'image/svg+xml',
    ];
    const allowExt = ['jpg', 'jpeg', 'png', 'webp', 'svg'];

    if (allowMime.includes((mime ?? '').toLowerCase())) return;
    if (
      (mime === 'application/octet-stream' || !mime) &&
      ext &&
      allowExt.includes(ext)
    )
      return;

    throw new BadRequestException('invalid image mime type');
  }

  // อัพโหลดไฟล์ภาพผ่าน form-data (รองรับขนาดสูงสุด 30MB) และบันทึก metadata ลง DB
  async uploadImageFileAndPersist(file: Express.Multer.File, adminId: string) {
    if (!file) throw new BadRequestException('file missing');

    this.validateImageMime(file.mimetype, file.originalname);

    const maxSize = Number(
      process.env.IMAGE_MAX_SIZE_BYTES ?? 30 * 1024 * 1024,
    ); // 30MB by default
    if (file.size > maxSize) {
      throw new BadRequestException('file too large');
    }

    const bucket = this.aws.bucket;

    // สร้างชื่อไฟล์แบบสุ่มเพื่อเก็บใน storage โดยใช้ UUID และเก็บในโฟลเดอร์ images/
    const uuid = randomUUID();
    const storageKey = `images/${uuid}`;

    // อัพโหลดไฟล์ไปยัง storage provider (เช่น S3) โดยใช้ buffer ที่ได้จาก multer
    await this.aws.putObject(
      bucket,
      storageKey,
      file.buffer,
      file.size,
      file.mimetype,
    );

    // สร้าง URL สาธารณะสำหรับเข้าถึงไฟล์ผ่าน CloudFront
    const publicUrl = this.aws.buildPublicUrl(bucket, storageKey);

    const saved = await this.repo.save(
      this.repo.create({
        adminId,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: String(file.size),
        storageProvider: 's3',
        storageBucket: bucket,
        storageKey,
        publicUrl,
        status: ImageAssetStatus.READY,
      }),
    );

    return {
      image_id: saved.id,
      url: saved.publicUrl,
      status: saved.status,
    };
  }

  // ดึง URL สาธารณะของภาพโดยใช้ ID จาก DB ถ้าไม่พบจะโยน NotFoundException ออกมา
  async getPublicUrlById(id: number) {
    const asset = await this.repo.findOne({ where: { id } });
    if (!asset) throw new NotFoundException('image asset not found');

    // ถ้า publicUrl มีอยู่แล้วก็ใช้เลย ถ้าไม่ก็สร้างจาก storage key และ bucket
    const url =
      asset.publicUrl ??
      this.aws.buildPublicUrl(asset.storageBucket, asset.storageKey);

    return {
      image_id: asset.id,
      url,
      mime_type: asset.mimeType,
    };
  }

  async updateImageAsset(id: number, dto: UpdateImageDto) {
    const hasAnyField = Object.values(dto).some((v) => v !== undefined);
    if (!hasAnyField) {
      throw new BadRequestException('no fields to update');
    }

    const asset = await this.repo.findOne({ where: { id } });
    if (!asset) throw new NotFoundException('image asset not found');

    if (dto.mime_type !== undefined) {
      this.validateImageMime(
        dto.mime_type,
        dto.original_filename ?? asset.originalFilename,
      );
      asset.mimeType = dto.mime_type;
    }

    if (dto.original_filename !== undefined) {
      asset.originalFilename = dto.original_filename;
    }

    const saved = await this.repo.save(asset);

    return {
      image_id: saved.id,
      url:
        saved.publicUrl ??
        this.aws.buildPublicUrl(saved.storageBucket, saved.storageKey),
      status: saved.status,
      original_filename: saved.originalFilename,
      mime_type: saved.mimeType,
    };
  }

  async deleteImageById(id: number) {
    const asset = await this.repo.findOne({ where: { id } });
    if (!asset) throw new NotFoundException('media asset not found');

    await this.aws.deleteObject(asset.storageBucket, asset.storageKey);

    await this.repo.remove(asset);
    return { deleted: true };
  }
}
