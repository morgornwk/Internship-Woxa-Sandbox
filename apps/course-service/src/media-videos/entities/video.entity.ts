import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum VideoAssetStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

@Entity('video')
export class VideoAsset {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'uuid', nullable: true })
  adminId?: string | null;

  @Column({ name: 'original_filename', nullable: true })
  originalFilename?: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes: string;

  @Column({ name: 'storage_provider', nullable: true })
  storageProvider?: string;

  @Column({ name: 'storage_bucket', nullable: true })
  storageBucket?: string;

  @Column({
    name: 'storage_key',
    type: 'varchar',
    length: 1024,
    nullable: true,
  })
  storageKey?: string;

  @Column({ name: 'public_url', type: 'varchar', length: 2048, nullable: true })
  publicUrl?: string;

  @Column({
    type: 'enum',
    enum: VideoAssetStatus,
    default: VideoAssetStatus.UPLOADING,
  })
  status: VideoAssetStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
