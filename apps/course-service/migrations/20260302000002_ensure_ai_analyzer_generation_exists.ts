import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class EnsureAiAnalyzerGenerationExists20260302000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const oldName = 'ai_quiz_generations';
    const tableName = 'ai_analyzer_generation';

    const existing = await queryRunner.getTable(tableName);
    if (!existing) {
      const oldTable = await queryRunner.getTable(oldName);
      if (oldTable) {
        await queryRunner.renameTable(oldName, tableName);
      } else {
        await queryRunner.createTable(
          new Table({
            name: tableName,
            columns: [
              {
                name: 'ai_quiz_id',
                type: 'int',
                isPrimary: true,
                isGenerated: true,
                generationStrategy: 'increment',
              },
              { name: 'lesson_id', type: 'int', isNullable: false },
              { name: 'prompt_used', type: 'text', isNullable: false },
              { name: 'ai_response', type: 'jsonb', isNullable: false },
              {
                name: 'model_name',
                type: 'varchar',
                length: '100',
                isNullable: false,
              },
              { name: 'prompt_tokens', type: 'int', isNullable: true },
              { name: 'completion_tokens', type: 'int', isNullable: true },
              { name: 'total_tokens', type: 'int', isNullable: true },
              {
                name: 'status',
                type: 'varchar',
                length: '20',
                isNullable: false,
                default: "'PENDING'",
              },
              { name: 'error_message', type: 'text', isNullable: true },
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
      }
    }

    const table = await queryRunner.getTable(tableName);
    if (!table) return;

    const indexName = 'idx_ai_quiz_lesson_id';
    const hasIndex =
      table.indices.some((i) => i.name === indexName) ||
      table.indices.some((i) => i.columnNames.join(',') === 'lesson_id');

    if (!hasIndex) {
      await queryRunner.createIndex(
        tableName,
        new TableIndex({
          name: indexName,
          columnNames: ['lesson_id'],
        }),
      );
    }

    const hasFk = table.foreignKeys.some(
      (fk) =>
        fk.columnNames.includes('lesson_id') &&
        fk.referencedTableName === 'lessons',
    );

    if (!hasFk) {
      await queryRunner.createForeignKey(
        tableName,
        new TableForeignKey({
          name: 'FK_ai_analyzer_generation_lesson_id',
          columnNames: ['lesson_id'],
          referencedTableName: 'lessons',
          referencedColumnNames: ['lesson_id'],
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'ai_analyzer_generation';
    const table = await queryRunner.getTable(tableName);
    if (!table) return;

    await queryRunner.dropTable(tableName, true);
  }
}
