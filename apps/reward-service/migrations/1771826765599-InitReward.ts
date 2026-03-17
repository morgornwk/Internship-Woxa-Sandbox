import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitReward1771826765599 implements MigrationInterface {
  name = 'InitReward1771826765599';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_redemption_user_reward"`);
    await queryRunner.query(`DROP INDEX "public"."idx_redemption_user"`);
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" RENAME COLUMN "user_id" TO "uuid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "uuid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "uuid" character varying NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "uuid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "uuid" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" RENAME COLUMN "uuid" TO "user_id"`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_redemption_user" ON "reward_redemptions" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_redemption_user_reward" ON "reward_redemptions" ("rewardId", "user_id") `,
    );
  }
}
