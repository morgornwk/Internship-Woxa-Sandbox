import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { VideoAsset, VideoAssetStatus } from './entities/video.entity';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { AwsS3StorageService } from '../storage/aws.service';

@Injectable()
export class MediaVideosService {
  private readonly logger = new Logger(MediaVideosService.name);

  constructor(
    @InjectRepository(VideoAsset)
    private readonly repo: Repository<VideoAsset>,
    private readonly aws: AwsS3StorageService
  ) { }

  // เช็คว่า MIME type ของไฟล์วิดีโอที่อัพโหลดมานั้นอยู่ใน allowlist หรือไม่ ถ้าไม่อยู่ให้โยน BadRequestException ออกมา
  private validateVideoMime(mimeType: string, originalFilename?: string) {
    const normalizedMime = (mimeType ?? '').trim().toLowerCase();

    const allowMimes = 'video/mp4,video/webm,video/quicktime,video/x-msvideo,video/avi,video/x-matroska,video/mpeg,application/octet-stream'
      .split(',')
      .map((x) => x.trim().toLowerCase());

    if (allowMimes.includes(normalizedMime)) return;

    // บาง browser/SDK อาจส่งเป็น octet-stream: ให้ fallback เช็คจากนามสกุลไฟล์
    const allowExt = (process.env.VIDEO_EXT_ALLOWLIST ?? 'mp4,webm,mov,avi,mkv,mpeg,mpg')
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);

    const ext = (originalFilename ?? '').split('.').pop()?.toLowerCase();
    if ((normalizedMime === 'application/octet-stream' || !normalizedMime) && ext && allowExt.includes(ext)) {
      return;
    }

    throw new BadRequestException(`mime type not allowed: ${mimeType}`);
  }

  // สร้าง presigned upload URL สำหรับอัพโหลดวิดีโอ (สำหรับไฟล์ขนาดใหญ่ - สูงสุด 1GB)
  async createPresignedUpload(dto: CreateVideoDto, adminId: string) {
    this.validateVideoMime(dto.mime_type, dto.original_filename);

    const maxSize = Number(process.env.VIDEO_MAX_SIZE_BYTES) || 1 * 1024 * 1024 * 1024; // 1GB

    if (dto.size_bytes > maxSize) {
      throw new BadRequestException('file size exceeds limit');
    }

    // สร้างชื่อไฟล์แบบสุ่มเพื่อเก็บใน storage โดยใช้ UUID และเก็บในโฟลเดอร์ videos/
    const bucket = this.aws.bucket;
    const videoId = randomUUID();
    const key = `videos/${videoId}`;

    // สร้าง presigned URL สำหรับอัพโหลดไปยัง S3 โดยกำหนด content type และระยะเวลาหมดอายุ (เช่น 15 นาที)
    const uploadUrl = await this.aws.presignPut(bucket, key, dto.mime_type, 60 * 15);

    const asset = this.repo.create({
      adminId,
      originalFilename: dto.original_filename ?? `${videoId}`,
      mimeType: dto.mime_type,
      sizeBytes: String(dto.size_bytes),
      storageProvider: 's3',
      storageBucket: bucket,
      storageKey: key,
      status: VideoAssetStatus.UPLOADING,
    });

    const saved = await this.repo.save(asset);

    return {
      video_id: saved.id,
      upload_url: uploadUrl,
      public_url: this.aws.buildPublicUrl(bucket, key),
    };
  }

  // ยืนยันการอัพโหลดโดยตรวจสอบว่าไฟล์ที่อัพโหลดไปยัง S3 มีอยู่จริงหรือไม่ ถ้ามีให้เปลี่ยนสถานะเป็น READY และบันทึก URL สาธารณะใน DB
  async confirmUpload(id: number) {
    const asset = await this.repo.findOne({ where: { id } });
    if (!asset) throw new NotFoundException('video asset not found');

    const bucket = asset.storageBucket!;
    const key = asset.storageKey!;

    const exists = await this.aws.fileExists(bucket, key);
    if (!exists) throw new BadRequestException('file not uploaded yet');

    asset.status = VideoAssetStatus.READY;
    const publicUrl = this.aws.buildPublicUrl(bucket, key);
    asset.publicUrl = publicUrl;
    await this.repo.save(asset);

    return {
      success: true,
      video_id: asset.id,
      public_url: publicUrl,
    };
  }

  async getPublicViewUrl(id: number) {
    const asset = await this.repo.findOne({ where: { id } });
    if (!asset) throw new NotFoundException('video asset not found');

    const url = asset.publicUrl ?? this.aws.buildPublicUrl(asset.storageBucket ?? this.aws.bucket, asset.storageKey!);

    return {
      video_id: asset.id,
      url,
      public_url: url,
    };
  }

  async updateVideoAsset(id: number, dto: UpdateVideoDto) {
    const hasAnyField = Object.values(dto).some((v) => v !== undefined);
    if (!hasAnyField) {
      throw new BadRequestException('no fields to update');
    }

    const asset = await this.repo.findOne({ where: { id } });
    if (!asset) throw new NotFoundException('video asset not found');

    if (dto.original_filename !== undefined) asset.originalFilename = dto.original_filename;
    if (dto.mime_type !== undefined) asset.mimeType = dto.mime_type;
    if (dto.size_bytes !== undefined) asset.sizeBytes = String(dto.size_bytes);
    if (dto.storage_bucket !== undefined) asset.storageBucket = dto.storage_bucket;
    if (dto.storage_key !== undefined) asset.storageKey = dto.storage_key;
    if (dto.public_url !== undefined) asset.publicUrl = dto.public_url;
    if (dto.status !== undefined) asset.status = dto.status;

    const saved = await this.repo.save(asset);

    return {
      video_id: saved.id,
      status: saved.status,
      original_filename: saved.originalFilename,
      mime_type: saved.mimeType,
      size_bytes: Number(saved.sizeBytes),
      storage_bucket: saved.storageBucket,
      storage_key: saved.storageKey,
      public_url: saved.publicUrl,
    };
  }

  async deleteVideoById(id: number): Promise<{ message: string }> {
    const asset = await this.repo.findOne({ where: { id } });
    if (!asset) throw new NotFoundException('video asset not found');

    const bucket = asset.storageBucket ?? this.aws.bucket;
    const key = asset.storageKey;

    // ลบไฟล์จาก storage provider (เช่น S3) ถ้า bucket และ key มีอยู่
    if (bucket && key) {
      try {
        await this.aws.deleteObject(bucket, key);
      } catch (err) {
        this.logger.error(`Failed to delete video file ${key}: ${String(err)}`);
      }
    }

    await this.repo.remove(asset);
    return { message: `Video deleted successfully :${id}` };
  }
}