import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitReward1771830936218 implements MigrationInterface {
  name = 'InitReward1771830936218';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "user_uuid" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "redeem_token" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD CONSTRAINT "UQ_abb737663620040cea4bf3e6fcd" UNIQUE ("redeem_token")`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "used_points"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "used_points" numeric(6,0) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ALTER COLUMN "delete_at" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ALTER COLUMN "delete_at" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ALTER COLUMN "delete_at" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ALTER COLUMN "delete_at" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "used_points"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "used_points" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP CONSTRAINT "UQ_abb737663620040cea4bf3e6fcd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "redeem_token"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "user_uuid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "userId" character varying NOT NULL`,
    );
  }
}
