import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnpublishLessonsWithoutContent20260310000000 implements MigrationInterface {
  name = 'UnpublishLessonsWithoutContent20260310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE lessons l
      SET is_published = false
      WHERE l.is_published = true
        AND (
          (l.lesson_type = 'article' AND NOT EXISTS (
            SELECT 1
            FROM articles a
            WHERE a.lesson_id = l.lesson_id
          ))
          OR (l.lesson_type = 'quiz' AND NOT EXISTS (
            SELECT 1
            FROM quizs q
            WHERE q.lesson_id = l.lesson_id
          ))
          OR (l.lesson_type = 'checkpoint' AND NOT EXISTS (
            SELECT 1
            FROM quizs_checkpoint qc
            WHERE qc.lesson_id = l.lesson_id
          ))
          OR (l.lesson_type = 'video' AND (l.lesson_video_url IS NULL OR BTRIM(l.lesson_video_url) = ''))
        )
    `);

    await queryRunner.query(`
      UPDATE chapters c
      SET is_published = EXISTS (
        SELECT 1
        FROM lessons l
        WHERE l.chapter_id = c.chapter_id
          AND l.is_published = true
      )
    `);
  }

  public async down(): Promise<void> {
    return;
  }
}