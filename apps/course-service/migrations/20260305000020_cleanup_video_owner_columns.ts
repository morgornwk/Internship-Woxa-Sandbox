import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanupVideoOwnerColumns20260305000020 implements MigrationInterface {
  name = 'CleanupVideoOwnerColumns20260305000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure the desired column exists.
    await queryRunner.query(
      `ALTER TABLE "video" ADD COLUMN IF NOT EXISTS "admin_id" uuid;`,
    );

    // If owner_user_id exists, migrate data into admin_id then drop it.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.table_name = 'video'
            AND c.column_name = 'owner_user_id'
        ) THEN
          EXECUTE 'UPDATE "video" SET "admin_id" = COALESCE("admin_id", "owner_user_id") WHERE "owner_user_id" IS NOT NULL';

          -- Drop old index if present.
          EXECUTE 'DROP INDEX IF EXISTS "idx_video_owner_user_id"';

          EXECUTE 'ALTER TABLE "video" DROP COLUMN IF EXISTS "owner_user_id"';
        END IF;
      END $$;
    `);

    // If owner_user_id_legacy exists, best-effort migrate into admin_id then drop it.
    await queryRunner.query(`
      DO $$
      DECLARE col_udt text;
      BEGIN
        SELECT c.udt_name
        INTO col_udt
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'video'
          AND c.column_name = 'owner_user_id_legacy';

        IF col_udt IS NOT NULL THEN
          -- If it's already uuid, migrate directly.
          IF col_udt = 'uuid' THEN
            EXECUTE 'UPDATE "video" SET "admin_id" = COALESCE("admin_id", "owner_user_id_legacy") WHERE "owner_user_id_legacy" IS NOT NULL';
          ELSE
            -- Otherwise try to cast to uuid (ignore rows that can\'t be cast).
            BEGIN
              EXECUTE 'UPDATE "video" '
                || 'SET "admin_id" = COALESCE("admin_id", NULLIF("owner_user_id_legacy"::text, '''')::uuid) '
                || 'WHERE "owner_user_id_legacy" IS NOT NULL';
            EXCEPTION WHEN invalid_text_representation THEN
              -- Leave admin_id as-is if legacy values are not UUID.
              NULL;
            END;
          END IF;

          EXECUTE 'ALTER TABLE "video" DROP COLUMN IF EXISTS "owner_user_id_legacy"';
        END IF;
      END $$;
    `);

    // Ensure the desired index exists.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_video_admin_id"
      ON "video" ("admin_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate owner_user_id from admin_id (best-effort)
    await queryRunner.query(
      `ALTER TABLE "video" ADD COLUMN IF NOT EXISTS "owner_user_id" uuid;`,
    );
    await queryRunner.query(
      `UPDATE "video" SET "owner_user_id" = "admin_id" WHERE "owner_user_id" IS NULL AND "admin_id" IS NOT NULL;`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_video_admin_id";`);

    // Keep admin_id (down migration shouldn't destroy data unless explicitly required)
    // If you want strict rollback, uncomment the next line.
    // await queryRunner.query(`ALTER TABLE "video" DROP COLUMN IF EXISTS "admin_id";`);
  }
}
