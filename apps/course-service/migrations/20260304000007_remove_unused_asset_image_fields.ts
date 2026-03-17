import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class RemoveUnusedAssetImageFields20260304000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('asset_image');
    if (!table) return;

    if (table.findColumnByName('storage_provider')) {
      await queryRunner.dropColumn('asset_image', 'storage_provider');
    }

    if (table.findColumnByName('storage_bucket')) {
      await queryRunner.dropColumn('asset_image', 'storage_bucket');
    }

    if (table.findColumnByName('storage_key')) {
      await queryRunner.dropColumn('asset_image', 'storage_key');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'asset_image',
      new TableColumn({
        name: 'storage_provider',
        type: 'varchar',
        length: '32',
        default: "'s3'",
      }),
    );

    await queryRunner.addColumn(
      'asset_image',
      new TableColumn({
        name: 'storage_bucket',
        type: 'varchar',
        length: '255',
      }),
    );

    await queryRunner.addColumn(
      'asset_image',
      new TableColumn({
        name: 'storage_key',
        type: 'varchar',
        length: '1024',
      }),
    );
  }
}
