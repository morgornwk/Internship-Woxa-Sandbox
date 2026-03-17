import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitReward1772011446845 implements MigrationInterface {
  name = 'InitReward1772011446845';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" ADD "isUsed" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" DROP COLUMN "isUsed"`,
    );
  }
}
