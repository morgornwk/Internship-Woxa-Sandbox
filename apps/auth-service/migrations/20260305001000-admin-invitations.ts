import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminInvitations20260305001000 implements MigrationInterface {
  name = 'AdminInvitations20260305001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS admin_invitations (
        id SERIAL PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        responsibility VARCHAR(100),
        user_id UUID NOT NULL,
        invited_by_user_id UUID NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT fk_admin_invitations_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_admin_invitations_user_id ON admin_invitations(user_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_admin_invitations_expires_at ON admin_invitations(expires_at)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS admin_invitations`);
  }
}
