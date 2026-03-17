import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AssetMediaType {
  IMAGE = 'image',
  VIDEO = 'video',
}

export enum AssetMediaStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

@Entity('asset_media')
export class AssetMedia {
  @PrimaryGeneratedColumn()
  assetMediaId: number;

  @Index('idx_asset_media_admin_id')
  @Column({ name: 'admin_id', type: 'uuid' })
  adminId: string;

  @Index('idx_asset_media_type')
  @Column({ name: 'type', type: 'varchar', length: 10 })
  type: AssetMediaType;

  @Column({
    name: 'original_filename',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  originalFilename?: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 255 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes: string;

  @Column({ name: 'duration_seconds', type: 'integer', nullable: true })
  durationSeconds?: number;

  @Column({
    name: 'thumbnail_url',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  thumbnailUrl?: string;

  @Column({ name: 'public_url', type: 'varchar', length: 2048, nullable: true })
  publicUrl?: string;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: AssetMediaStatus.UPLOADING,
  })
  status: AssetMediaStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
