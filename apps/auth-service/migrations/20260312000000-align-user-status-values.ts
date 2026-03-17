import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignUserStatusValues20260312000000 implements MigrationInterface {
  name = 'AlignUserStatusValues20260312000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE users
      SET status = CASE LOWER(status)
        WHEN 'not_active' THEN 'inactive'
        WHEN 'waiting_confirm' THEN 'invited'
        WHEN 'invitation_expired' THEN 'expired'
        ELSE status
      END
      WHERE LOWER(status) IN ('not_active', 'waiting_confirm', 'invitation_expired')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE users
      SET status = CASE LOWER(status)
        WHEN 'inactive' THEN 'not_active'
        WHEN 'invited' THEN 'waiting_confirm'
        WHEN 'expired' THEN 'invitation_expired'
        ELSE status
      END
      WHERE LOWER(status) IN ('inactive', 'invited', 'expired')
    `);
  }
}
