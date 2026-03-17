import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncExpiredRewardsInactive1772895600000 implements MigrationInterface {
  name = 'SyncExpiredRewardsInactive1772895600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "rewards"
      SET "is_active" = false
      WHERE "is_active" = true
        AND "redeem_end_date" IS NOT NULL
        AND "redeem_end_date" < (NOW() AT TIME ZONE 'Asia/Bangkok')
    `);
  }

  public down(): Promise<void> {
    return Promise.resolve();
  }
}
