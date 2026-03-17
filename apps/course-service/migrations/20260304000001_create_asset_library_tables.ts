import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAssetLibraryTables20260304000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'asset_image_assets',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'admin_id', type: 'uuid', isNullable: false },
          {
            name: 'original_filename',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'mime_type',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          { name: 'size_bytes', type: 'bigint', isNullable: false },
          {
            name: 'storage_provider',
            type: 'varchar',
            length: '32',
            isNullable: false,
            default: "'s3'",
          },
          {
            name: 'storage_bucket',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'storage_key',
            type: 'varchar',
            length: '1024',
            isNullable: false,
          },
          {
            name: 'public_url',
            type: 'varchar',
            length: '2048',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: "'uploading'",
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'asset_image_assets',
      new TableIndex({
        name: 'idx_asset_image_assets_admin_id',
        columnNames: ['admin_id'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'asset_video_assets',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'admin_id', type: 'uuid', isNullable: false },
          {
            name: 'original_filename',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'mime_type',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          { name: 'size_bytes', type: 'bigint', isNullable: false },
          {
            name: 'storage_provider',
            type: 'varchar',
            length: '32',
            isNullable: false,
            default: "'s3'",
          },
          {
            name: 'storage_bucket',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'storage_key',
            type: 'varchar',
            length: '1024',
            isNullable: false,
          },
          {
            name: 'public_url',
            type: 'varchar',
            length: '2048',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: "'uploading'",
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'asset_video_assets',
      new TableIndex({
        name: 'idx_asset_video_assets_admin_id',
        columnNames: ['admin_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('asset_video_assets', true);
    await queryRunner.dropTable('asset_image_assets', true);
  }
}
