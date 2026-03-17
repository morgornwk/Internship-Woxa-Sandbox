import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminIdToMediaAssets20260305000010 implements MigrationInterface {
  name = 'AddAdminIdToMediaAssets20260305000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // image.admin_id
    await queryRunner.query(`
      ALTER TABLE "image"
      ADD COLUMN IF NOT EXISTS "admin_id" uuid;
    `);

    // video.admin_id (migrate from legacy owner_user_id)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.table_name = 'video'
            AND c.column_name = 'admin_id'
        ) THEN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = 'video'
              AND c.column_name = 'owner_user_id'
          ) THEN
            EXECUTE 'ALTER TABLE "video" RENAME COLUMN "owner_user_id" TO "admin_id"';
          ELSE
            EXECUTE 'ALTER TABLE "video" ADD COLUMN "admin_id" uuid';
          END IF;
        END IF;
      END $$;
    `);

    // Keep an index for filtering by admin_id.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_class
          WHERE relkind = 'i'
            AND relname = 'idx_video_owner_user_id'
        ) THEN
          EXECUTE 'ALTER INDEX "idx_video_owner_user_id" RENAME TO "idx_video_admin_id"';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_video_admin_id"
      ON "video" ("admin_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_video_admin_id";`);

    // Rename back if we originally renamed owner_user_id -> admin_id
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.table_name = 'video'
            AND c.column_name = 'admin_id'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.table_name = 'video'
            AND c.column_name = 'owner_user_id'
        ) THEN
          EXECUTE 'ALTER TABLE "video" RENAME COLUMN "admin_id" TO "owner_user_id"';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_class
          WHERE relkind = 'i'
            AND relname = 'idx_video_admin_id'
        ) AND NOT EXISTS (
          SELECT 1
          FROM pg_class
          WHERE relkind = 'i'
            AND relname = 'idx_video_owner_user_id'
        ) THEN
          EXECUTE 'ALTER INDEX "idx_video_admin_id" RENAME TO "idx_video_owner_user_id"';
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE "video" DROP COLUMN IF EXISTS "admin_id";`,
    );
    await queryRunner.query(
      `ALTER TABLE "image" DROP COLUMN IF EXISTS "admin_id";`,
    );
  }
}
