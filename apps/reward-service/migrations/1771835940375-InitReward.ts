import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitReward1771835940375 implements MigrationInterface {
  name = 'InitReward1771835940375';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rewards" ADD "delete_at" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rewards" DROP COLUMN "delete_at"`);
  }
}
