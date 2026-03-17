import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAssetImage20260304000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'asset_image',
        columns: [
          {
            name: 'assetImageId',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'admin_id',
            type: 'uuid',
            isNullable: false,
          },
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
          {
            name: 'size_bytes',
            type: 'bigint',
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
            default: "'uploading'",
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'asset_image',
      new TableIndex({
        name: 'idx_asset_image_admin_id',
        columnNames: ['admin_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('asset_image');
  }
}
