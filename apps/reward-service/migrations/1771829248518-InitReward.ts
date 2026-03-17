import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitReward1771829248518 implements MigrationInterface {
  name = 'InitReward1771829248518';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rewards" ALTER COLUMN "total_limit" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rewards" ALTER COLUMN "total_limit" DROP NOT NULL`,
    );
  }
}
