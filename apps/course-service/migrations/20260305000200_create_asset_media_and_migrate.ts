import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAssetMediaAndMigrate20260305000200 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasAssetMedia = await queryRunner.hasTable('asset_media');

    if (!hasAssetMedia) {
      await queryRunner.createTable(
        new Table({
          name: 'asset_media',
          columns: [
            {
              name: 'assetMediaId',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'admin_id', type: 'uuid', isNullable: false },
            { name: 'type', type: 'varchar', length: '10', isNullable: false },
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
            { name: 'duration_seconds', type: 'integer', isNullable: true },
            {
              name: 'thumbnail_url',
              type: 'varchar',
              length: '2048',
              isNullable: true,
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
              type: 'timestamp',
              isNullable: false,
              default: 'now()',
            },
            {
              name: 'updated_at',
              type: 'timestamp',
              isNullable: false,
              default: 'now()',
            },
          ],
        }),
        true,
      );

      await queryRunner.createIndex(
        'asset_media',
        new TableIndex({
          name: 'idx_asset_media_admin_id',
          columnNames: ['admin_id'],
        }),
      );

      await queryRunner.createIndex(
        'asset_media',
        new TableIndex({
          name: 'idx_asset_media_type',
          columnNames: ['type'],
        }),
      );
    }

    const hasAssetImage = await queryRunner.hasTable('asset_image');
    if (hasAssetImage) {
      await queryRunner.query(`
        INSERT INTO asset_media (
          admin_id,
          type,
          original_filename,
          mime_type,
          size_bytes,
          public_url,
          status,
          created_at,
          updated_at
        )
        SELECT
          admin_id,
          'image' AS type,
          original_filename,
          mime_type,
          size_bytes,
          public_url,
          status,
          created_at,
          updated_at
        FROM asset_image
      `);

      // remove old table to enforce single-table model
      await queryRunner.dropTable('asset_image', true);
    }

    const hasAssetVideo = await queryRunner.hasTable('asset_video');
    if (hasAssetVideo) {
      await queryRunner.query(`
        INSERT INTO asset_media (
          admin_id,
          type,
          original_filename,
          mime_type,
          size_bytes,
          duration_seconds,
          thumbnail_url,
          public_url,
          status,
          created_at,
          updated_at
        )
        SELECT
          admin_id,
          'video' AS type,
          original_filename,
          mime_type,
          size_bytes,
          duration_seconds,
          thumbnail_url,
          public_url,
          status,
          created_at,
          updated_at
        FROM asset_video
      `);

      // remove old table to enforce single-table model
      await queryRunner.dropTable('asset_video', true);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasAssetMedia = await queryRunner.hasTable('asset_media');
    if (!hasAssetMedia) return;

    // Recreate legacy tables (best-effort) and move data back.
    const hasAssetImage = await queryRunner.hasTable('asset_image');
    if (!hasAssetImage) {
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
              type: 'timestamp',
              isNullable: false,
              default: 'now()',
            },
            {
              name: 'updated_at',
              type: 'timestamp',
              isNullable: false,
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

    const hasAssetVideo = await queryRunner.hasTable('asset_video');
    if (!hasAssetVideo) {
      await queryRunner.createTable(
        new Table({
          name: 'asset_video',
          columns: [
            {
              name: 'assetVideoId',
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
            { name: 'duration_seconds', type: 'integer', isNullable: true },
            {
              name: 'thumbnail_url',
              type: 'varchar',
              length: '2048',
              isNullable: true,
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
              type: 'timestamp',
              isNullable: false,
              default: 'now()',
            },
            {
              name: 'updated_at',
              type: 'timestamp',
              isNullable: false,
              default: 'now()',
            },
          ],
        }),
        true,
      );

      await queryRunner.createIndex(
        'asset_video',
        new TableIndex({
          name: 'idx_asset_video_admin_id',
          columnNames: ['admin_id'],
        }),
      );
    }

    await queryRunner.query(`
      INSERT INTO asset_image (
        admin_id,
        original_filename,
        mime_type,
        size_bytes,
        public_url,
        status,
        created_at,
        updated_at
      )
      SELECT
        admin_id,
        original_filename,
        mime_type,
        size_bytes,
        public_url,
        status,
        created_at,
        updated_at
      FROM asset_media
      WHERE type = 'image'
    `);

    await queryRunner.query(`
      INSERT INTO asset_video (
        admin_id,
        original_filename,
        mime_type,
        size_bytes,
        duration_seconds,
        thumbnail_url,
        public_url,
        status,
        created_at,
        updated_at
      )
      SELECT
        admin_id,
        original_filename,
        mime_type,
        size_bytes,
        duration_seconds,
        thumbnail_url,
        public_url,
        status,
        created_at,
        updated_at
      FROM asset_media
      WHERE type = 'video'
    `);

    await queryRunner.dropTable('asset_media', true);
  }
}
