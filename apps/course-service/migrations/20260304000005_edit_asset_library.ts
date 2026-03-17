import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class EditAssetLibrary20260304000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
     * -------------------------
     * RENAME TABLES
     * -------------------------
     */

    await queryRunner.renameTable('asset_image_assets', 'asset_image');
    await queryRunner.renameTable('asset_video_assets', 'asset_video');

    /**
     * -------------------------
     * RENAME ID COLUMNS
     * -------------------------
     */

    await queryRunner.renameColumn('asset_image', 'id', 'assetImageId');
    await queryRunner.renameColumn('asset_video', 'id', 'assetVideoId');

    /**
     * -------------------------
     * ADD NEW VIDEO COLUMNS
     * -------------------------
     */

    await queryRunner.addColumn(
      'asset_video',
      new TableColumn({
        name: 'duration_seconds',
        type: 'integer',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'asset_video',
      new TableColumn({
        name: 'thumbnail_url',
        type: 'varchar',
        length: '2048',
        isNullable: true,
      }),
    );

    /**
     * -------------------------
     * DROP UNUSED COLUMNS
     * -------------------------
     */

    const videoTable = await queryRunner.getTable('asset_video');

    if (videoTable?.findColumnByName('storage_provider')) {
      await queryRunner.dropColumn('asset_video', 'storage_provider');
    }

    if (videoTable?.findColumnByName('storage_bucket')) {
      await queryRunner.dropColumn('asset_video', 'storage_bucket');
    }

    if (videoTable?.findColumnByName('storage_key')) {
      await queryRunner.dropColumn('asset_video', 'storage_key');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    /**
     * -------------------------
     * ADD BACK STORAGE COLUMNS
     * -------------------------
     */

    await queryRunner.addColumn(
      'asset_video',
      new TableColumn({
        name: 'storage_provider',
        type: 'varchar',
        length: '32',
        default: "'s3'",
      }),
    );

    await queryRunner.addColumn(
      'asset_video',
      new TableColumn({
        name: 'storage_bucket',
        type: 'varchar',
        length: '255',
      }),
    );

    await queryRunner.addColumn(
      'asset_video',
      new TableColumn({
        name: 'storage_key',
        type: 'varchar',
        length: '1024',
      }),
    );

    /**
     * -------------------------
     * REMOVE NEW COLUMNS
     * -------------------------
     */

    await queryRunner.dropColumn('asset_video', 'duration_seconds');
    await queryRunner.dropColumn('asset_video', 'thumbnail_url');

    /**
     * -------------------------
     * RENAME ID COLUMNS BACK
     * -------------------------
     */

    await queryRunner.renameColumn('asset_image', 'assetImageId', 'id');
    await queryRunner.renameColumn('asset_video', 'assetVideoId', 'id');

    /**
     * -------------------------
     * RENAME TABLES BACK
     * -------------------------
     */

    await queryRunner.renameTable('asset_image', 'asset_image_assets');
    await queryRunner.renameTable('asset_video', 'asset_video_assets');
  }
}
