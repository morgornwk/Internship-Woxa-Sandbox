import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitReward1771927568859 implements MigrationInterface {
  name = 'InitReward1771927568859';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rewards" DROP COLUMN "expire_after_days"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rewards" DROP COLUMN "show_remaining_threshold"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rewards" ADD "show_remaining_threshold" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "rewards" ADD "expire_after_days" integer`,
    );
  }
}
