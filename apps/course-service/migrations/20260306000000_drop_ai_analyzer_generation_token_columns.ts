import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class DropAiAnalyzerGenerationTokenColumns20260306000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'ai_analyzer_generation';
    const table = await queryRunner.getTable(tableName);
    if (!table) return;

    const columnsToDrop = [
      'prompt_tokens',
      'completion_tokens',
      'total_tokens',
    ];

    for (const columnName of columnsToDrop) {
      const column = table.findColumnByName(columnName);
      if (column) {
        await queryRunner.dropColumn(tableName, column);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'ai_analyzer_generation';
    const table = await queryRunner.getTable(tableName);
    if (!table) return;

    const maybeAddColumn = async (column: TableColumn) => {
      const exists = table.findColumnByName(column.name);
      if (!exists) {
        await queryRunner.addColumn(tableName, column);
      }
    };

    await maybeAddColumn(
      new TableColumn({
        name: 'prompt_tokens',
        type: 'int',
        isNullable: true,
      }),
    );

    await maybeAddColumn(
      new TableColumn({
        name: 'completion_tokens',
        type: 'int',
        isNullable: true,
      }),
    );

    await maybeAddColumn(
      new TableColumn({
        name: 'total_tokens',
        type: 'int',
        isNullable: true,
      }),
    );
  }
}
