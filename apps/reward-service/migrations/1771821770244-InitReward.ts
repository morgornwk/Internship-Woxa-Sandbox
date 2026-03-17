import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitReward1771821770244 implements MigrationInterface {
  name = 'InitReward1771821770244';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_redemption_redeemed_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_redemption_user_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_redemption_user_reward"`);
    await queryRunner.query(`DROP INDEX "public"."idx_redemption_user"`);
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "usedPoints"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "expireAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "redeemedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "user_id" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "used_points" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "expire_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "redeemed_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "delete_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_redemption_redeemed_at" ON "reward_redemptions" ("redeemed_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_redemption_user_status" ON "reward_redemptions" ("user_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_redemption_user_reward" ON "reward_redemptions" ("user_id", "rewardId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_redemption_user" ON "reward_redemptions" ("user_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_redemption_user"`);
    await queryRunner.query(`DROP INDEX "public"."idx_redemption_user_reward"`);
    await queryRunner.query(`DROP INDEX "public"."idx_redemption_user_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_redemption_redeemed_at"`);
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "delete_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "redeemed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "expire_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "used_points"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "redeemedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "expireAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "usedPoints" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "userId" integer NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_redemption_user" ON "reward_redemptions" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_redemption_user_reward" ON "reward_redemptions" ("userId", "rewardId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_redemption_user_status" ON "reward_redemptions" ("userId", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_redemption_redeemed_at" ON "reward_redemptions" ("redeemedAt") `,
    );
  }
}
