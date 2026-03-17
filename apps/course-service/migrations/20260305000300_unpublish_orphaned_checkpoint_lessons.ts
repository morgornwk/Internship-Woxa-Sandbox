import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnpublishOrphanedCheckpointLessons20260305000300 implements MigrationInterface {
  name = 'UnpublishOrphanedCheckpointLessons20260305000300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(`
      SELECT COUNT(*)::int AS count
      FROM lessons l
      WHERE l.lesson_type = 'checkpoint'
        AND l.is_published = true
        AND NOT EXISTS (
          SELECT 1
          FROM quizs_checkpoint qc
          WHERE qc.lesson_id = l.lesson_id
        )
    `);

    const count =
      Array.isArray(rows) && rows.length > 0 ? Number(rows[0].count) : 0;

    await queryRunner.query(`
      UPDATE lessons l
      SET is_published = false
      WHERE l.lesson_type = 'checkpoint'
        AND l.is_published = true
        AND NOT EXISTS (
          SELECT 1
          FROM quizs_checkpoint qc
          WHERE qc.lesson_id = l.lesson_id
        )
    `);

    console.log(
      `✅ Unpublished ${count} checkpoint lessons without checkpoint content`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Data cleanup migration - no safe automatic rollback.
  }
}
