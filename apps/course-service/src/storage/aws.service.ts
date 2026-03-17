import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { lookup } from 'mime-types';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.name === 'NotFound';
}

// AWS S3 Storage Service
@Injectable()
export class AwsS3StorageService {
  private readonly logger = new Logger(AwsS3StorageService.name);
  private readonly s3: S3Client;
  private readonly region: string;
  private readonly _bucket: string;
  private readonly cloudfrontDomain: string;

  // ใน constructor จะตรวจสอบ environment variables ที่จำเป็นและสร้าง S3 client ขึ้นมา
  constructor() {
    if (!process.env.AWS_REGION) {
      throw new Error('AWS_REGION environment variable is required');
    }
    if (!process.env.AWS_S3_BUCKET) {
      throw new Error('AWS_S3_BUCKET environment variable is required');
    }
    if (!process.env.AWS_CLOUDFRONT_DOMAIN) {
      throw new Error('AWS_CLOUDFRONT_DOMAIN environment variable is required');
    }

    this.region = process.env.AWS_REGION;
    this._bucket = process.env.AWS_S3_BUCKET;
    this.cloudfrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN;

    // อนุญาตให้ใช้ AWS credentials จาก environment variables หรือจาก IAM role
    const credentials =
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined;

    this.s3 = new S3Client({
      region: this.region,
      ...(credentials && { credentials }),
    });

    this.logger.log(
      `AWS S3 initialized → bucket: ${this._bucket}, region: ${this.region}, CDN: ${this.cloudfrontDomain}`,
    );
  }

  // getter สำหรับ bucket เพื่อให้สามารถเข้าถึงได้จากภายนอก
  get bucket(): string {
    return this._bucket;
  }

  // ฟังก์ชันหลักสำหรับอัพโหลดไฟล์ไปยัง S3 โดยรับ bucket, key, body, size และ metadata (ถ้ามี) และจัดการ Content-Type อัตโนมัติ
  async putObject(
    bucket: string,
    key: string,
    body: Buffer,
    size?: number,
    contentType?: string,
  ): Promise<void> {
    try {
      const resolvedContentType = contentType ?? this.detectContentType(key);

      const cmd = new PutObjectCommand({
        Bucket: bucket || this._bucket,
        Key: key,
        Body: body,
        ContentType: resolvedContentType,
        ContentLength: size,
        ACL: 'private', // ใช้ private แล้วให้ CloudFront จัดการ caching แทน
        CacheControl: 'max-age=31536000', // cache 1 ปี
      });

      await this.s3.send(cmd);
      this.logger.debug(`Uploaded: s3://${bucket || this._bucket}/${key}`);
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.error(`Failed to upload ${key}: ${message}`);
      throw new InternalServerErrorException(
        `Failed to upload file: ${message}`,
      );
    }
  }

  async uploadFile(params: {
    key: string;
    body: Buffer;
    contentType?: string;
    bucket?: string;
  }): Promise<{ key: string; url: string }> {
    const bucket = params.bucket || this._bucket;
    const contentType =
      params.contentType || this.detectContentType(params.key);

    await this.putObject(
      bucket,
      params.key,
      params.body,
      params.body.length,
      contentType,
    );

    return {
      key: params.key,
      url: this.buildPublicUrl(bucket, params.key),
    };
  }

  // ฟังก์ชันสำหรับลบไฟล์จาก S3 โดยรับ bucket และ key ของไฟล์ที่ต้องการลบ
  async deleteObject(bucket: string, key: string): Promise<void> {
    try {
      const cmd = new DeleteObjectCommand({
        Bucket: bucket || this._bucket,
        Key: key,
      });

      await this.s3.send(cmd);
      this.logger.debug(`Deleted: s3://${bucket || this._bucket}/${key}`);
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.error(`Failed to delete ${key}: ${message}`);
      throw new InternalServerErrorException(
        `Failed to delete file: ${message}`,
      );
    }
  }

  // ฟังก์ชันสำหรับสร้าง URL สาธารณะของไฟล์ที่อัพโหลดไปยัง S3 โดยใช้ CloudFront URL แทน S3 URL เพื่อประสิทธิภาพและ caching ที่ดีขึ้น
  buildPublicUrl(bucket: string, key: string): string {
    return `https://${this.cloudfrontDomain}/${encodeURI(key)}`;
  }

  // สำหรับกรณีที่ต้องการ S3 URL ตรงๆ
  getS3Url(bucket: string, key: string): string {
    return `https://${bucket || this._bucket}.s3.${this.region}.amazonaws.com/${encodeURI(key)}`;
  }

  // สร้าง Presigned PUT URL (ให้อัปโหลดขึ้น S3 ได้ตรง ๆ ภายในเวลาที่กำหนด)
  async presignPut(
    bucket: string,
    key: string,
    contentType: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const cmd = new PutObjectCommand({
        Bucket: bucket || this._bucket,
        Key: key,
        ContentType: contentType,
        ACL: 'private',
      });

      return await getSignedUrl(this.s3, cmd, { expiresIn });
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned PUT URL: ${getErrorMessage(error)}`,
      );
      throw new InternalServerErrorException('Failed to generate upload URL');
    }
  }

  // ตรวจสอบว่าไฟล์มีอยู่ใน S3 หรือไม่
  async fileExists(bucket: string, key: string): Promise<boolean> {
    try {
      const cmd = new HeadObjectCommand({
        Bucket: bucket || this._bucket,
        Key: key,
      });

      await this.s3.send(cmd);
      return true;
    } catch (error) {
      if (isNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  // ตรวจสอบและกำหนด Content-Type จาก metadata หรือจากนามสกุลไฟล์
  private detectContentType(key: string): string {
    // ใช้ mime-types library เพื่อตรวจสอบ Content-Type จากนามสกุลไฟล์
    const mimeType = lookup(key);
    if (mimeType) {
      return mimeType;
    }

    // ถ้าไม่รู้จักนามสกุลไฟล์ ให้ตรวจสอบ prefix ของ key เพื่อกำหนด Content-Type
    if (key.startsWith('images/')) {
      return 'image/jpeg';
    }
    if (key.startsWith('videos/')) {
      return 'video/mp4';
    }

    return 'application/octet-stream';
  }

  // Generate a unique storage key for images
  // Format: images/{uuid}.{ext}
  generateImageKey(originalFilename: string): string {
    const uuid = randomUUID();
    const ext = this.getFileExtension(originalFilename) || 'jpg';
    return `images/${uuid}.${ext}`;
  }

  // Generate a unique storage key for videos
  // Format: videos/{uuid}.{ext}
  generateVideoKey(originalFilename: string): string {
    const uuid = randomUUID();
    const ext = this.getFileExtension(originalFilename) || 'mp4';
    return `videos/${uuid}.${ext}`;
  }

  // ฟังก์ชันช่วยเหลือสำหรับดึงนามสกุลไฟล์จากชื่อไฟล์ (ใช้ในการสร้าง storage key ที่มีนามสกุลถูกต้อง)
  private getFileExtension(filename: string): string | null {
    if (!filename) return null;
    const match = filename.match(/\.([^.]+)$/); // ดึงนามสกุลไฟล์จากชื่อไฟล์
    return match ? match[1].toLowerCase() : null;
  }

  // เรียก MediaConvert endpoint และ cache ไว้ในตัวแปรเพื่อใช้ซ้ำในการสร้างงานแปลงวิดีโอ (เพื่อลด latency ในการสร้างงานแปลงวิดีโอในอนาคต)
  // private async getMediaConvertEndpoint(): Promise<string> {
  //   if (this.cachedMcEndpoint) return this.cachedMcEndpoint;

  //   const client = new MediaConvertClient({ region: this.region });
  //   const res = await client.send(new DescribeEndpointsCommand({}));
  //   if (!res.Endpoints || res.Endpoints.length === 0) {
  //     throw new BadRequestException('No MediaConvert endpoints returned');
  //   }

  //   this.cachedMcEndpoint = res.Endpoints[0].Url!;
  //   this.logger.log(`MediaConvert endpoint: ${this.cachedMcEndpoint}`);
  //   return this.cachedMcEndpoint;
  // }

  // สร้างงาน MediaConvert เพื่อแปลงวิดีโอ (เพื่อใช้ในฟีเจอร์ Video Transcoding ในอนาคต)
  // async createMediaConvertJob(inputS3Url: string, outputS3Prefix: string, roleArn: string) {
  //   const endpoint = await this.getMediaConvertEndpoint();
  //   const mc = new MediaConvertClient({
  //     region: this.region,
  //     endpoint,
  //   });

  //   const jobSettings: any = {
  //     OutputGroups: [
  //       {
  //         Name: 'Apple HLS',
  //         OutputGroupSettings: {
  //           Type: 'HLS_GROUP_SETTINGS',
  //           HlsGroupSettings: {
  //             Destination: `s3://${this._bucket}/${outputS3Prefix}`,
  //             SegmentLength: 6,
  //             MinSegmentLength: 0,
  //           },
  //         },
  //         Outputs: [
  //           // 1080p
  //           {
  //             ContainerSettings: { Container: 'M3U8', M3u8Settings: {} },
  //             VideoDescription: {
  //               CodecSettings: {
  //                 Codec: 'H_264',
  //                 H264Settings: {
  //                   RateControlMode: 'CBR',
  //                   Bitrate: 6500000,
  //                   CodecProfile: 'MAIN',
  //                   Height: 1080,
  //                   Width: 1920,
  //                   MaxBitrate: 6500000,
  //                   SceneChangeDetect: 'TRANSITION_DETECTION',
  //                 },
  //               },
  //             },
  //             AudioDescriptions: [
  //               {
  //                 CodecSettings: {
  //                   Codec: 'AAC',
  //                   AacSettings: { Bitrate: 96000, CodingMode: 'CODING_MODE_2_0', SampleRate: 48000 },
  //                 },
  //               },
  //             ],
  //           },
  //           // 720p
  //           {
  //             ContainerSettings: { Container: 'M3U8', M3u8Settings: {} },
  //             VideoDescription: {
  //               CodecSettings: {
  //                 Codec: 'H_264',
  //                 H264Settings: {
  //                   RateControlMode: 'CBR',
  //                   Bitrate: 3500000,
  //                   CodecProfile: 'MAIN',
  //                   Height: 720,
  //                   Width: 1280,
  //                   MaxBitrate: 3500000,
  //                   SceneChangeDetect: 'TRANSITION_DETECTION',
  //                 },
  //               },
  //             },
  //             AudioDescriptions: [
  //               {
  //                 CodecSettings: {
  //                   Codec: 'AAC',
  //                   AacSettings: { Bitrate: 96000, CodingMode: 'CODING_MODE_2_0', SampleRate: 48000 },
  //                 },
  //               },
  //             ],
  //           },
  //           // 360p
  //           {
  //             ContainerSettings: { Container: 'M3U8', M3u8Settings: {} },
  //             VideoDescription: {
  //               CodecSettings: {
  //                 Codec: 'H_264',
  //                 H264Settings: {
  //                   RateControlMode: 'CBR',
  //                   Bitrate: 800000,
  //                   CodecProfile: 'MAIN',
  //                   Height: 360,
  //                   Width: 640,
  //                   MaxBitrate: 800000,
  //                   SceneChangeDetect: 'TRANSITION_DETECTION',
  //                 },
  //               },
  //             },
  //             AudioDescriptions: [
  //               {
  //                 CodecSettings: {
  //                   Codec: 'AAC',
  //                   AacSettings: { Bitrate: 64000, CodingMode: 'CODING_MODE_2_0', SampleRate: 48000 },
  //                 },
  //               },
  //             ],
  //           },
  //         ],
  //       },
  //     ],
  //     AdAvailOffset: 0,
  //     Inputs: [{ FileInput: inputS3Url }],
  //   };

  //   const createJobCmd = new CreateJobCommand({ Role: roleArn, Settings: jobSettings });
  //   const res = await mc.send(createJobCmd);
  //   this.logger.log(`MediaConvert job created: ${res.Job?.Id}`);
  //   return res.Job;
  // }

  // ฟังก์ชันช่วยเหลือสำหรับการสร้าง video ID แบบสุ่ม (ถ้าต้องการใช้ในที่อื่นๆ)
  generateVideoId(): string {
    return randomUUID().replace(/-/g, '').slice(0, 12);
  }
}

// Export alias for backward compatibility
export { AwsS3StorageService as AwsService };
