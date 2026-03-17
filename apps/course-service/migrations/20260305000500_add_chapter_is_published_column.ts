import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChapterIsPublishedColumn20260305000500 implements MigrationInterface {
  name = 'AddChapterIsPublishedColumn20260305000500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chapters" ADD COLUMN IF NOT EXISTS "is_published" boolean NOT NULL DEFAULT false;`,
    );

    // Backfill from lessons: chapter is published if it has at least one published lesson.
    await queryRunner.query(`
      UPDATE "chapters" ch
      SET "is_published" = EXISTS (
        SELECT 1
        FROM "lessons" l
        WHERE l."chapter_id" = ch."chapter_id"
          AND l."is_published" = true
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_chapters_is_published" ON "chapters" ("is_published");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_chapters_is_published";`,
    );
    await queryRunner.query(
      `ALTER TABLE "chapters" DROP COLUMN IF EXISTS "is_published";`,
    );
  }
}
