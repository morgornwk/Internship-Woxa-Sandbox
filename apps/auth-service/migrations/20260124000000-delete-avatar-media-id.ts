import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveAvatarMediaId20260305000000 implements MigrationInterface {
  name = 'RemoveAvatarMediaId20260305000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "avatar_media_id";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "avatar_media_id" VARCHAR(255);
    `);
  }
}
