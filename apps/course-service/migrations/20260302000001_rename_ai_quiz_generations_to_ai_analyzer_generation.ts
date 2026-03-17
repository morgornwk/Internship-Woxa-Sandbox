import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameAiQuizGenerationsToAiAnalyzerGeneration20260302000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const oldName = 'ai_quiz_generations';
    const newName = 'ai_analyzer_generation';

    const newTable = await queryRunner.getTable(newName);
    if (newTable) {
      // already renamed / created with the new name
      return;
    }

    const oldTable = await queryRunner.getTable(oldName);
    if (!oldTable) {
      // nothing to rename
      return;
    }

    await queryRunner.renameTable(oldName, newName);

    // Optional: rename FK for clarity (not required by TypeORM runtime)
    const fkOld = 'FK_ai_quiz_generations_lesson_id';
    const fkNew = 'FK_ai_analyzer_generation_lesson_id';
    const renamed = await queryRunner.getTable(newName);
    const fk = renamed?.foreignKeys.find((f) => f.name === fkOld);
    if (fk) {
      await queryRunner.query(
        `ALTER TABLE "${newName}" RENAME CONSTRAINT "${fkOld}" TO "${fkNew}"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const oldName = 'ai_quiz_generations';
    const newName = 'ai_analyzer_generation';

    const oldTable = await queryRunner.getTable(oldName);
    if (oldTable) {
      return;
    }

    const newTable = await queryRunner.getTable(newName);
    if (!newTable) {
      return;
    }

    // revert FK name back if it was renamed
    const fkOld = 'FK_ai_quiz_generations_lesson_id';
    const fkNew = 'FK_ai_analyzer_generation_lesson_id';
    const fk = newTable.foreignKeys.find((f) => f.name === fkNew);
    if (fk) {
      await queryRunner.query(
        `ALTER TABLE "${newName}" RENAME CONSTRAINT "${fkNew}" TO "${fkOld}"`,
      );
    }

    await queryRunner.renameTable(newName, oldName);
  }
}
