import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVideoOwnerUserIdUuid20260305000000 implements MigrationInterface {
  name = 'AddVideoOwnerUserIdUuid20260305000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE col_udt text;
      BEGIN
        SELECT c.udt_name
        INTO col_udt
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'video'
          AND c.column_name = 'owner_user_id';

        IF col_udt IS NULL THEN
          EXECUTE 'ALTER TABLE "video" ADD COLUMN IF NOT EXISTS "owner_user_id" uuid';
        ELSIF col_udt <> 'uuid' THEN
          -- Preserve legacy data (if any) by renaming the old column.
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = 'video'
              AND c.column_name = 'owner_user_id'
          ) AND NOT EXISTS (
            SELECT 1
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = 'video'
              AND c.column_name = 'owner_user_id_legacy'
          ) THEN
            EXECUTE 'ALTER TABLE "video" RENAME COLUMN "owner_user_id" TO "owner_user_id_legacy"';
          END IF;

          EXECUTE 'ALTER TABLE "video" ADD COLUMN IF NOT EXISTS "owner_user_id" uuid';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_video_owner_user_id"
      ON "video" ("owner_user_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_video_owner_user_id";`);

    await queryRunner.query(
      `ALTER TABLE "video" DROP COLUMN IF EXISTS "owner_user_id";`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.table_name = 'video'
            AND c.column_name = 'owner_user_id_legacy'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.table_name = 'video'
            AND c.column_name = 'owner_user_id'
        ) THEN
          EXECUTE 'ALTER TABLE "video" RENAME COLUMN "owner_user_id_legacy" TO "owner_user_id"';
        END IF;
      END $$;
    `);
  }
}
