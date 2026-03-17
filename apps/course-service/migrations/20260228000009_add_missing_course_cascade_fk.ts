import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

export class AddMissingCourseCascadeFK20260228000009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. ตรวจสอบและเพิ่ม FK lessons.chapter_id → chapters.chapter_id (CASCADE)
    const lessonsTable = await queryRunner.getTable('lessons');
    const lessonsFK = lessonsTable?.foreignKeys.find(
      (fk) =>
        fk.columnNames.includes('chapter_id') &&
        fk.referencedTableName === 'chapters',
    );

    if (!lessonsFK) {
      await queryRunner.createForeignKey(
        'lessons',
        new TableForeignKey({
          name: 'FK_lessons_chapter_id',
          columnNames: ['chapter_id'],
          referencedTableName: 'chapters',
          referencedColumnNames: ['chapter_id'],
          onDelete: 'CASCADE',
        }),
      );
      console.log('✅ Added FK_lessons_chapter_id');
    }

    // 2. ตรวจสอบและเพิ่ม FK chapters.level_id → levels.level_id (CASCADE)
    const chaptersTable = await queryRunner.getTable('chapters');
    const chaptersFK = chaptersTable?.foreignKeys.find(
      (fk) =>
        fk.columnNames.includes('level_id') &&
        fk.referencedTableName === 'levels',
    );

    if (!chaptersFK) {
      await queryRunner.createForeignKey(
        'chapters',
        new TableForeignKey({
          name: 'FK_chapters_level_id',
          columnNames: ['level_id'],
          referencedTableName: 'levels',
          referencedColumnNames: ['level_id'],
          onDelete: 'CASCADE',
        }),
      );
      console.log('✅ Added FK_chapters_level_id');
    }

    // 3. ตรวจสอบและเพิ่ม FK levels.course_id → courses.course_id (CASCADE)
    const levelsTable = await queryRunner.getTable('levels');
    const levelsFK = levelsTable?.foreignKeys.find(
      (fk) =>
        fk.columnNames.includes('course_id') &&
        fk.referencedTableName === 'courses',
    );

    if (!levelsFK) {
      await queryRunner.createForeignKey(
        'levels',
        new TableForeignKey({
          name: 'FK_levels_course_id',
          columnNames: ['course_id'],
          referencedTableName: 'courses',
          referencedColumnNames: ['course_id'],
          onDelete: 'CASCADE',
        }),
      );
      console.log('✅ Added FK_levels_course_id');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.dropForeignKey('lessons', 'FK_lessons_chapter_id');
    await queryRunner.dropForeignKey('chapters', 'FK_chapters_level_id');
    await queryRunner.dropForeignKey('levels', 'FK_levels_course_id');
  }
}
