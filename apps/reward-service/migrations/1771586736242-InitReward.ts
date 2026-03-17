import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitReward1771586736242 implements MigrationInterface {
  name = 'InitReward1771586736242';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."reward_redemptions_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "reward_redemptions" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "usedPoints" integer NOT NULL, "status" "public"."reward_redemptions_status_enum" NOT NULL DEFAULT 'PENDING', "expireAt" TIMESTAMP, "redeemedAt" TIMESTAMP NOT NULL DEFAULT now(), "rewardId" integer, CONSTRAINT "PK_e02d178fa8c54295d8edc8781b3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_redemption_redeemed_at" ON "reward_redemptions" ("redeemedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_redemption_user_status" ON "reward_redemptions" ("userId", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_redemption_user_reward" ON "reward_redemptions" ("userId", "rewardId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_redemption_status" ON "reward_redemptions" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_redemption_reward" ON "reward_redemptions" ("rewardId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_redemption_user" ON "reward_redemptions" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."rewards_redemption_type_enum" AS ENUM('SPOT', 'SELF_PICKUP', 'DELIVERY', 'BOTH')`,
    );
    await queryRunner.query(
      `CREATE TABLE "rewards" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "description" text NOT NULL, "remain" numeric(6) NOT NULL, "image_url" character varying NOT NULL, "required_points" numeric(6) NOT NULL, "redeem_start_date" TIMESTAMP NOT NULL, "redeem_end_date" TIMESTAMP NOT NULL, "redemption_type" "public"."rewards_redemption_type_enum" NOT NULL, "expire_after_days" integer, "limit_per_user" integer, "total_limit" integer, "show_remaining_threshold" integer, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3d947441a48debeb9b7366f8b8c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reward_active_period" ON "rewards" ("is_active", "redeem_start_date", "redeem_end_date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reward_points" ON "rewards" ("required_points") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reward_period" ON "rewards" ("redeem_start_date", "redeem_end_date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reward_active" ON "rewards" ("is_active") `,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD CONSTRAINT "FK_7405900a3e5b2843630b0a83cbe" FOREIGN KEY ("rewardId") REFERENCES "rewards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP CONSTRAINT "FK_7405900a3e5b2843630b0a83cbe"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_reward_active"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reward_period"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reward_points"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reward_active_period"`);
    await queryRunner.query(`DROP TABLE "rewards"`);
    await queryRunner.query(
      `DROP TYPE "public"."rewards_redemption_type_enum"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_redemption_user"`);
    await queryRunner.query(`DROP INDEX "public"."idx_redemption_reward"`);
    await queryRunner.query(`DROP INDEX "public"."idx_redemption_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_redemption_user_reward"`);
    await queryRunner.query(`DROP INDEX "public"."idx_redemption_user_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_redemption_redeemed_at"`);
    await queryRunner.query(`DROP TABLE "reward_redemptions"`);
    await queryRunner.query(
      `DROP TYPE "public"."reward_redemptions_status_enum"`,
    );
  }
}
