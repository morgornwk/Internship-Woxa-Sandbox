import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignRewardTimesToBangkok1772908200000 implements MigrationInterface {
  name = 'AlignRewardTimesToBangkok1772908200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "rewards"
      SET
        "redeem_start_date" = CASE
          WHEN "redeem_start_date" IS NULL THEN NULL
          ELSE "redeem_start_date" + INTERVAL '7 hours'
        END,
        "redeem_end_date" = CASE
          WHEN "redeem_end_date" IS NULL THEN NULL
          ELSE "redeem_end_date" + INTERVAL '7 hours'
        END
    `);

    await queryRunner.query(`
      UPDATE "reward_redemptions"
      SET
        "expire_at" = CASE
          WHEN "expire_at" IS NULL THEN NULL
          ELSE "expire_at" + INTERVAL '7 hours'
        END
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "reward_redemptions"
      SET
        "expire_at" = CASE
          WHEN "expire_at" IS NULL THEN NULL
          ELSE "expire_at" - INTERVAL '7 hours'
        END
    `);

    await queryRunner.query(`
      UPDATE "rewards"
      SET
        "redeem_start_date" = CASE
          WHEN "redeem_start_date" IS NULL THEN NULL
          ELSE "redeem_start_date" - INTERVAL '7 hours'
        END,
        "redeem_end_date" = CASE
          WHEN "redeem_end_date" IS NULL THEN NULL
          ELSE "redeem_end_date" - INTERVAL '7 hours'
        END
    `);
  }
}