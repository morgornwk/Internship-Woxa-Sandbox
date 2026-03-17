import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitReward1771829648642 implements MigrationInterface {
  name = 'InitReward1771829648642';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" RENAME COLUMN "uuid" TO "userId"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reward_redemptions" RENAME COLUMN "userId" TO "uuid"`,
    );
  }
}
