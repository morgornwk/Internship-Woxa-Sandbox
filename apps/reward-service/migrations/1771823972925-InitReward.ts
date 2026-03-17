import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitReward1771823972925 implements MigrationInterface {
  name = 'InitReward1771823972925';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_redemption_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_redemption_user_status"`);
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "status"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."reward_redemptions_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rewards" DROP COLUMN "redemption_type"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."rewards_redemption_type_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."rewards_redemption_type_enum" AS ENUM('SPOT', 'SELF_PICKUP', 'DELIVERY', 'BOTH')`,
    );
    await queryRunner.query(
      `ALTER TABLE "rewards" ADD "redemption_type" "public"."rewards_redemption_type_enum" NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reward_redemptions_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "status" "public"."reward_redemptions_status_enum" NOT NULL DEFAULT 'PENDING'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_redemption_user_status" ON "reward_redemptions" ("status", "user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_redemption_status" ON "reward_redemptions" ("status") `,
    );
  }
}
