import { InternalServerErrorException } from '@nestjs/common';

const sendMock = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  class S3Client {
    config: any;
    constructor(config: any) {
      this.config = config;
    }
    send = sendMock;
  }

  class PutObjectCommand {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  }

  class DeleteObjectCommand {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  }

  class HeadObjectCommand {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  }

  return {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
  };
});

const getSignedUrlMock = jest.fn();

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: any[]) => getSignedUrlMock(...args),
}));

jest.mock('crypto', () => ({
  randomUUID: () => 'uuid-1',
}));

import { AwsS3StorageService } from './aws.service';

describe('AwsS3StorageService', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...envBackup,
      AWS_REGION: 'ap-southeast-1',
      AWS_S3_BUCKET: 'bucket1',
      AWS_CLOUDFRONT_DOMAIN: 'cdn.example.com',
    };
    sendMock.mockReset();
    getSignedUrlMock.mockReset();
  });

  afterAll(() => {
    process.env = envBackup;
  });

  it('throws when required env missing', () => {
    delete process.env.AWS_REGION;
    expect(() => new AwsS3StorageService()).toThrow(/AWS_REGION/);
  });

  it('exposes bucket getter', () => {
    const svc = new AwsS3StorageService();
    expect(svc.bucket).toBe('bucket1');
  });

  describe('buildPublicUrl', () => {
    it('uses CloudFront domain and encodes key', () => {
      const svc = new AwsS3StorageService();
      const url = svc.buildPublicUrl('bucket1', 'images/a b.png');
      expect(url).toBe('https://cdn.example.com/images/a%20b.png');
    });
  });

  describe('putObject', () => {
    it('sends PutObjectCommand', async () => {
      const svc = new AwsS3StorageService();
      sendMock.mockResolvedValue(undefined);

      await svc.putObject(
        'bucket1',
        'images/x.png',
        Buffer.from('x'),
        1,
        'image/png',
      );

      expect(sendMock).toHaveBeenCalledTimes(1);
    });

    it('wraps errors in InternalServerErrorException', async () => {
      const svc = new AwsS3StorageService();
      sendMock.mockRejectedValue(new Error('boom'));

      await expect(
        svc.putObject('bucket1', 'images/x.png', Buffer.from('x')),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('deleteObject', () => {
    it('sends DeleteObjectCommand', async () => {
      const svc = new AwsS3StorageService();
      sendMock.mockResolvedValue(undefined);
      await svc.deleteObject('bucket1', 'images/x.png');
      expect(sendMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('presignPut', () => {
    it('returns signed url', async () => {
      const svc = new AwsS3StorageService();
      getSignedUrlMock.mockResolvedValue('https://signed');

      const url = await svc.presignPut(
        'bucket1',
        'videos/x.mp4',
        'video/mp4',
        60,
      );
      expect(url).toBe('https://signed');
      expect(getSignedUrlMock).toHaveBeenCalled();
    });
  });

  describe('fileExists', () => {
    it('returns true when head succeeds', async () => {
      const svc = new AwsS3StorageService();
      sendMock.mockResolvedValue({});
      await expect(svc.fileExists('bucket1', 'k')).resolves.toBe(true);
    });

    it('returns false when NotFound', async () => {
      const svc = new AwsS3StorageService();
      const err: any = new Error('not found');
      err.name = 'NotFound';
      sendMock.mockRejectedValue(err);

      await expect(svc.fileExists('bucket1', 'k')).resolves.toBe(false);
    });
  });

  describe('generateImageKey / generateVideoKey', () => {
    it('generates deterministic keys with uuid and extension fallback', () => {
      const svc = new AwsS3StorageService();
      expect(svc.generateImageKey('a.PNG')).toBe('images/uuid-1.png');
      expect(svc.generateVideoKey('a')).toBe('videos/uuid-1.mp4');
    });
  });
});
