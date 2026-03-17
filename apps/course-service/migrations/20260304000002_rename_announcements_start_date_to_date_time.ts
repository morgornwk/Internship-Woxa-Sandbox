import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class RenameAnnouncementsStartDateToDateTime20260304000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'announcements';
    const indexName = 'idx_announcements_date_range';

    const table = await queryRunner.getTable(tableName);
    if (!table) return;

    const hasIndex = table.indices.some((i) => i.name === indexName);
    if (hasIndex) {
      await queryRunner.dropIndex(tableName, indexName);
    }

    const hasStartDate = table.columns.some((c) => c.name === 'start_date');
    const hasDateTime = table.columns.some((c) => c.name === 'date_time');

    if (hasStartDate && !hasDateTime) {
      await queryRunner.renameColumn(tableName, 'start_date', 'date_time');
    }

    const refreshed = await queryRunner.getTable(tableName);
    if (!refreshed) return;

    const hasDateTimeAfter = refreshed.columns.some(
      (c) => c.name === 'date_time',
    );
    const hasEndDate = refreshed.columns.some((c) => c.name === 'end_date');

    if (hasDateTimeAfter && hasEndDate) {
      const indexExistsNow = refreshed.indices.some(
        (i) => i.name === indexName,
      );
      if (!indexExistsNow) {
        await queryRunner.createIndex(
          tableName,
          new TableIndex({
            name: indexName,
            columnNames: ['date_time', 'end_date'],
          }),
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'announcements';
    const indexName = 'idx_announcements_date_range';

    const table = await queryRunner.getTable(tableName);
    if (!table) return;

    const hasIndex = table.indices.some((i) => i.name === indexName);
    if (hasIndex) {
      await queryRunner.dropIndex(tableName, indexName);
    }

    const hasStartDate = table.columns.some((c) => c.name === 'start_date');
    const hasDateTime = table.columns.some((c) => c.name === 'date_time');

    if (!hasStartDate && hasDateTime) {
      await queryRunner.renameColumn(tableName, 'date_time', 'start_date');
    }

    const refreshed = await queryRunner.getTable(tableName);
    if (!refreshed) return;

    const hasStartDateAfter = refreshed.columns.some(
      (c) => c.name === 'start_date',
    );
    const hasEndDate = refreshed.columns.some((c) => c.name === 'end_date');

    if (hasStartDateAfter && hasEndDate) {
      const indexExistsNow = refreshed.indices.some(
        (i) => i.name === indexName,
      );
      if (!indexExistsNow) {
        await queryRunner.createIndex(
          tableName,
          new TableIndex({
            name: indexName,
            columnNames: ['start_date', 'end_date'],
          }),
        );
      }
    }
  }
}
