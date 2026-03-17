import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ImageAssetStatus {
  UPLOADING = 'uploading',
  READY = 'ready',
  FAILED = 'failed',
}

@Entity('image')
export class ImageAsset {
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

  @Column({ name: 'storage_provider' })
  storageProvider: string;

  @Column({ name: 'storage_bucket' })
  storageBucket: string;

  @Column({ name: 'storage_key' })
  storageKey: string;

  @Column({ name: 'public_url', type: 'varchar', length: 2048, nullable: true })
  publicUrl?: string;

  @Column({
    type: 'enum',
    enum: ImageAssetStatus,
    default: ImageAssetStatus.UPLOADING,
  })
  status: ImageAssetStatus;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
  })
  updatedAt: Date;
}
