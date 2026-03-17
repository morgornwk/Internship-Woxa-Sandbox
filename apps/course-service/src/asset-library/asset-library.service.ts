import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { AwsS3StorageService } from '../storage/aws.service';
import {
  AssetMedia,
  AssetMediaStatus,
  AssetMediaType,
} from './entities/asset-media.entity';
import {
  CreateAssetVideoDto,
  UpdateAssetImageDto,
  UpdateAssetVideoDto,
} from './dto';

const IMAGE_MAX_SIZE = 30 * 1024 * 1024; // 30MB
const VIDEO_MAX_SIZE = 1 * 1024 * 1024 * 1024; // 1GB

@Injectable()
export class AssetLibraryService {
  private readonly logger = new Logger(AssetLibraryService.name);

  constructor(
    private readonly aws: AwsS3StorageService,

    @InjectRepository(AssetMedia)
    private readonly mediaRepo: Repository<AssetMedia>,
  ) {}

  /* -------------------------------------------------------------------------- */
  /*                                   CONFIG                                   */
  /* -------------------------------------------------------------------------- */

  private getBucket(): string {
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) throw new BadRequestException('AWS_S3_BUCKET not configured');
    return bucket;
  }

  private buildStorageKey(prefix: string) {
    return `${prefix}/${randomUUID()}`;
  }

  /* -------------------------------------------------------------------------- */
  /*                                VALIDATION                                  */
  /* -------------------------------------------------------------------------- */

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

    if (allowMime.includes(mime?.toLowerCase())) return;
    if (
      (mime === 'application/octet-stream' || !mime) &&
      ext &&
      allowExt.includes(ext)
    )
      return;

    throw new BadRequestException('invalid image mime type');
  }

  private validateVideoMime(mimeType: string, originalFilename?: string) {
    const normalizedMime = mimeType?.trim().toLowerCase();

    const allowMimes =
      'video/mp4,video/webm,video/quicktime,video/x-msvideo,video/avi,video/x-matroska,video/mpeg,application/octet-stream'
        .split(',')
        .map((x) => x.trim().toLowerCase());

    if (allowMimes.includes(normalizedMime)) return;

    const allowExt = (
      process.env.VIDEO_EXT_ALLOWLIST ?? 'mp4,webm,mov,avi,mkv,mpeg,mpg'
    )
      .split(',')
      .map((x) => x.trim().toLowerCase());

    const ext = originalFilename?.split('.').pop()?.toLowerCase();

    if (
      (normalizedMime === 'application/octet-stream' || !normalizedMime) &&
      ext &&
      allowExt.includes(ext)
    ) {
      return;
    }

    throw new BadRequestException(`mime type not allowed: ${mimeType}`);
  }

  // validate video by checking if the file exists in S3 (used for confirm video upload)
  private extractStorageKey(url: string): string {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  }

  /* -------------------------------------------------------------------------- */
  /*                                IMAGE UPLOAD                                */
  /* -------------------------------------------------------------------------- */

  async uploadAssetImage(adminId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('file missing');

    this.validateImageMime(file.mimetype, file.originalname);

    if (file.size > IMAGE_MAX_SIZE) {
      throw new BadRequestException('file too large');
    }

    const bucket = this.getBucket();
    const storageKey = this.buildStorageKey('library-images');

    await this.aws.putObject(
      bucket,
      storageKey,
      file.buffer,
      file.size,
      file.mimetype,
    );

    const publicUrl = this.aws.buildPublicUrl(bucket, storageKey);

    const asset = await this.mediaRepo.save(
      this.mediaRepo.create({
        adminId,
        type: AssetMediaType.IMAGE,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: String(file.size),
        publicUrl,
        status: AssetMediaStatus.READY,
      }),
    );

    return {
      assetMediaId: asset.assetMediaId,
      type: asset.type,
      url: asset.publicUrl,
      status: asset.status,
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                                VIDEO PRESIGN URL                           */
  /* -------------------------------------------------------------------------- */

  async createAssetVideoPresign(adminId: string, dto: CreateAssetVideoDto) {
    this.validateVideoMime(dto.mime_type, dto.original_filename);

    if (dto.size_bytes > VIDEO_MAX_SIZE) {
      throw new BadRequestException('file size exceeds limit');
    }

    const bucket = this.getBucket();
    const storageKey = this.buildStorageKey('library-videos');

    const uploadUrl = await this.aws.presignPut(
      bucket,
      storageKey,
      dto.mime_type,
      60 * 15,
    );

    const publicUrl = this.aws.buildPublicUrl(bucket, storageKey);

    const asset = await this.mediaRepo.save(
      this.mediaRepo.create({
        adminId,
        type: AssetMediaType.VIDEO,
        originalFilename: dto.original_filename ?? storageKey,
        mimeType: dto.mime_type,
        sizeBytes: String(dto.size_bytes),
        // durationSeconds: dto.duration_seconds,
        // thumbnailUrl: dto.thumbnail_url,
        publicUrl,
        status: AssetMediaStatus.UPLOADING,
      }),
    );

    return {
      assetMediaId: asset.assetMediaId,
      type: asset.type,
      uploadUrl,
      publicUrl,
      status: asset.status,
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                              CONFIRM VIDEO UPLOAD                          */
  /* -------------------------------------------------------------------------- */

  async confirmAssetVideo(assetVideoId: number) {
    const asset = await this.mediaRepo.findOne({
      where: { assetMediaId: assetVideoId, type: AssetMediaType.VIDEO },
    });

    if (!asset) {
      throw new NotFoundException('asset video not found');
    }

    if (asset.status !== AssetMediaStatus.UPLOADING) {
      throw new BadRequestException(
        `cannot confirm asset video with status ${asset.status}`,
      );
    }

    const bucket = this.getBucket();

    if (!asset.publicUrl) {
      throw new BadRequestException('missing publicUrl');
    }

    const storageKey = decodeURIComponent(
      new URL(asset.publicUrl).pathname.replace(/^\//, ''),
    );

    const exists = await this.aws.fileExists(bucket, storageKey);

    if (!exists) {
      throw new BadRequestException('file not uploaded yet');
    }

    asset.status = AssetMediaStatus.READY;

    await this.mediaRepo.save(asset);

    return {
      success: true,
      assetMediaId: asset.assetMediaId,
      type: asset.type,
      publicUrl: asset.publicUrl,
      status: asset.status,
    };
  }

  async getAssetLibraryAll(type?: AssetMediaType) {
    const where = type ? { type } : {};
    const assets = await this.mediaRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });

    if (!assets || assets.length === 0) {
      throw new NotFoundException('No assets found');
    }

    return assets;
  }

  async getAssetById(id: number) {
    const asset = await this.mediaRepo.findOne({ where: { assetMediaId: id } });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }
    return asset;
  }

  async updateAssetImage(id: number, dto: UpdateAssetImageDto) {
    const imageAsset = await this.mediaRepo.findOne({
      where: { assetMediaId: id, type: AssetMediaType.IMAGE },
    });

    if (!imageAsset) {
      throw new NotFoundException('Image not found');
    }

    Object.assign(imageAsset, {
      ...(dto.original_filename && { originalFilename: dto.original_filename }),
      ...(dto.public_url && { publicUrl: dto.public_url }),
      ...(dto.status && { status: dto.status }),
    });
    return this.mediaRepo.save(imageAsset);
  }

  async updateAssetVideo(id: number, dto: UpdateAssetVideoDto) {
    const videoAsset = await this.mediaRepo.findOne({
      where: { assetMediaId: id, type: AssetMediaType.VIDEO },
    });
    if (!videoAsset) {
      throw new NotFoundException('Video not found');
    }
    Object.assign(videoAsset, {
      ...(dto.original_filename && { originalFilename: dto.original_filename }),
      ...(dto.thumbnail_url && { thumbnailUrl: dto.thumbnail_url }),
      ...(dto.duration_seconds && { durationSeconds: dto.duration_seconds }),
      ...(dto.status && { status: dto.status }),
    });

    // this.logger.debug('Updating asset video:', videoAsset);
    return this.mediaRepo.save(videoAsset);
  }

  async deleteAssetById(id: number): Promise<{ message: string }> {
    const asset = await this.mediaRepo.findOne({
      where: { assetMediaId: id },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    if (!asset.publicUrl) {
      throw new BadRequestException('missing publicUrl');
    }

    const bucket = this.getBucket();
    const storageKey = this.extractStorageKey(asset.publicUrl);

    try {
      await this.aws.deleteObject(bucket, storageKey);
    } catch (err) {
      this.logger.warn('S3 delete failed', err?.name);
    }

    await this.mediaRepo.delete({ assetMediaId: id });

    return { message: `Asset deleted successfully : ${id}` };
  }
}
