import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class ChangeAnnouncementsDatesToTimestamp20260304000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'announcements';
    const indexName = 'idx_announcements_date_range';

    const table = await queryRunner.getTable(tableName);
    if (!table) return;

    const hasIndex = table.indices.some((i) => i.name === indexName);
    if (hasIndex) {
      await queryRunner.dropIndex(tableName, indexName);
    }

    const startCol = table.columns.find((c) => c.name === 'start_date');
    const endCol = table.columns.find((c) => c.name === 'end_date');

    if (startCol) {
      const type = String(startCol.type).toLowerCase();
      // timestamptz in Postgres is reported as "timestamp with time zone"
      if (type.includes('with time zone')) {
        await queryRunner.query(
          'ALTER TABLE "announcements" ALTER COLUMN "start_date" TYPE timestamp without time zone USING "start_date" AT TIME ZONE \'UTC\'',
        );
      }
    }

    if (endCol) {
      const type = String(endCol.type).toLowerCase();
      if (type.includes('with time zone')) {
        await queryRunner.query(
          'ALTER TABLE "announcements" ALTER COLUMN "end_date" TYPE timestamp without time zone USING "end_date" AT TIME ZONE \'UTC\'',
        );
      }
    }

    const refreshed = await queryRunner.getTable(tableName);
    if (!refreshed) return;

    const hasStartDate = refreshed.columns.some((c) => c.name === 'start_date');
    const hasEndDate = refreshed.columns.some((c) => c.name === 'end_date');

    if (hasStartDate && hasEndDate) {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'announcements';
    const indexName = 'idx_announcements_date_range';

    const table = await queryRunner.getTable(tableName);
    if (!table) return;

    const hasIndex = table.indices.some((i) => i.name === indexName);
    if (hasIndex) {
      await queryRunner.dropIndex(tableName, indexName);
    }

    const startCol = table.columns.find((c) => c.name === 'start_date');
    const endCol = table.columns.find((c) => c.name === 'end_date');

    if (startCol) {
      const type = String(startCol.type).toLowerCase();
      // timestamp without time zone in Postgres is reported as "timestamp"
      if (!type.includes('with time zone')) {
        await queryRunner.query(
          'ALTER TABLE "announcements" ALTER COLUMN "start_date" TYPE timestamptz USING "start_date" AT TIME ZONE \'UTC\'',
        );
      }
    }

    if (endCol) {
      const type = String(endCol.type).toLowerCase();
      if (!type.includes('with time zone')) {
        await queryRunner.query(
          'ALTER TABLE "announcements" ALTER COLUMN "end_date" TYPE timestamptz USING "end_date" AT TIME ZONE \'UTC\'',
        );
      }
    }

    const refreshed = await queryRunner.getTable(tableName);
    if (!refreshed) return;

    const hasStartDate = refreshed.columns.some((c) => c.name === 'start_date');
    const hasEndDate = refreshed.columns.some((c) => c.name === 'end_date');

    if (hasStartDate && hasEndDate) {
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
