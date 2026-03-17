import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddAdminIdToMediaAssets20260304000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addAdminIdColumn(
      queryRunner,
      'image_assets',
      'idx_image_assets_admin_id',
    );
    await this.addAdminIdColumn(
      queryRunner,
      'video_assets',
      'idx_video_assets_admin_id',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropAdminIdColumn(
      queryRunner,
      'video_assets',
      'idx_video_assets_admin_id',
    );
    await this.dropAdminIdColumn(
      queryRunner,
      'image_assets',
      'idx_image_assets_admin_id',
    );
  }

  private async addAdminIdColumn(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) return;

    const hasColumn = table.columns.some((c) => c.name === 'admin_id');
    if (!hasColumn) {
      await queryRunner.addColumn(
        tableName,
        new TableColumn({
          name: 'admin_id',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }

    const refreshed = await queryRunner.getTable(tableName);
    if (!refreshed) return;

    const hasIndex = refreshed.indices.some((i) => i.name === indexName);
    if (!hasIndex) {
      await queryRunner.createIndex(
        tableName,
        new TableIndex({
          name: indexName,
          columnNames: ['admin_id'],
        }),
      );
    }
  }

  private async dropAdminIdColumn(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) return;

    const hasIndex = table.indices.some((i) => i.name === indexName);
    if (hasIndex) {
      await queryRunner.dropIndex(tableName, indexName);
    }

    const hasColumn = table.columns.some((c) => c.name === 'admin_id');
    if (hasColumn) {
      await queryRunner.dropColumn(tableName, 'admin_id');
    }
  }
}
