import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveResponsibilityFromAdminInvitation1773292845506 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admin_invitations" DROP COLUMN "responsibility"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admin_invitations" ADD "responsibility" character varying(100)`,
    );
  }
}
