import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthAccountsSessionsUsers20260121000000 implements MigrationInterface {
  name = 'AuthAccountsSessionsUsers20260121000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        provider VARCHAR(20) NOT NULL,
        provider_user_id VARCHAR(255),
        email VARCHAR(255),
        password_hash TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_auth_provider UNIQUE (provider, provider_user_id),
        CONSTRAINT uq_auth_email UNIQUE (provider, email),
        CONSTRAINT chk_auth_provider CHECK (provider IN ('LOCAL','GOOGLE')),
        CONSTRAINT chk_local_password CHECK (
          (provider = 'LOCAL' AND password_hash IS NOT NULL)
          OR
          (provider <> 'LOCAL')
        ),
        CONSTRAINT chk_oauth_id CHECK (
          (provider <> 'LOCAL' AND provider_user_id IS NOT NULL)
          OR
          (provider = 'LOCAL')
        )
      )
    `);

    // If there are foreign keys (besides sessions/password_reset_tokens) that already reference
    // users(id), we must not attempt to drop/replace the users.id column.
    const userIdFkRefs: Array<{ table_name: string }> =
      await queryRunner.query(`
      SELECT tc.table_name AS table_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND ccu.table_schema = 'public'
        AND ccu.table_name = 'users'
        AND ccu.column_name = 'id'
    `);

    const hasOtherUserIdDependents = userIdFkRefs.some(
      (r) =>
        r.table_name !== 'sessions' && r.table_name !== 'password_reset_tokens',
    );
    const rewriteUserIds = !hasOtherUserIdDependents;

    // We can backfill auth_accounts from legacy columns either way; choose correct user id source.
    const userIdExpr = rewriteUserIds ? 'u.id_new' : 'u.id';
    await queryRunner.query(
      `ALTER TABLE users ALTER COLUMN email DROP NOT NULL`,
    );

    if (rewriteUserIds) {
      await queryRunner.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS id_new UUID`,
      );
      await queryRunner.query(
        `UPDATE users SET id_new = gen_random_uuid() WHERE id_new IS NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE users ALTER COLUMN id_new SET DEFAULT gen_random_uuid()`,
      );

      await queryRunner.query(
        `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id_new UUID`,
      );
      await queryRunner.query(
        `ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS user_id_new UUID`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS refresh_token_hash TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ`,
    );

    if (rewriteUserIds) {
      await queryRunner.query(`
        UPDATE sessions s
        SET user_id_new = u.id_new
        FROM users u
        WHERE s.user_id = u.id
      `);
      await queryRunner.query(`
        UPDATE password_reset_tokens prt
        SET user_id_new = u.id_new
        FROM users u
        WHERE prt.user_id = u.id
      `);
    }

    // Some legacy schemas don't have `sessions.refresh_token`. If it's missing, generate unique
    // placeholder values so we can safely enforce NOT NULL + UNIQUE on `refresh_token_hash`.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'sessions'
            AND column_name = 'refresh_token'
        ) THEN
          EXECUTE 'UPDATE sessions '
            || 'SET refresh_token_hash = encode(digest(refresh_token, ''sha256''), ''hex'') '
            || 'WHERE refresh_token IS NOT NULL';
        END IF;

        UPDATE sessions
        SET refresh_token_hash = gen_random_uuid()::text
        WHERE refresh_token_hash IS NULL;
      END $$;
    `);

    // Backfill auth_accounts from legacy user columns when they exist.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'password_hash'
        ) THEN
          EXECUTE 'INSERT INTO auth_accounts (user_id, provider, provider_user_id, email, password_hash, created_at) '
            || 'SELECT ${userIdExpr}, ''LOCAL'', NULL, u.email, u.password_hash, now() '
            || 'FROM users u '
            || 'WHERE u.password_hash IS NOT NULL';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'google_id'
        ) THEN
          EXECUTE 'INSERT INTO auth_accounts (user_id, provider, provider_user_id, email, password_hash, created_at) '
            || 'SELECT ${userIdExpr}, ''GOOGLE'', u.google_id, u.email, NULL, now() '
            || 'FROM users u '
            || 'WHERE u.google_id IS NOT NULL';
        END IF;
      END $$;
    `);

    if (rewriteUserIds) {
      await queryRunner.query(`
        DO $$
        DECLARE constraint_name text;
        BEGIN
          SELECT tc.constraint_name INTO constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = 'sessions'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = 'user_id';
          IF constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE sessions DROP CONSTRAINT %I', constraint_name);
          END IF;
        END$$;
      `);
      await queryRunner.query(`
        DO $$
        DECLARE constraint_name text;
        BEGIN
          SELECT tc.constraint_name INTO constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = 'password_reset_tokens'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = 'user_id';
          IF constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE password_reset_tokens DROP CONSTRAINT %I', constraint_name);
          END IF;
        END$$;
      `);

      await queryRunner.query(
        `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey`,
      );
      await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS id`);
      await queryRunner.query(`ALTER TABLE users RENAME COLUMN id_new TO id`);
      await queryRunner.query(`ALTER TABLE users ADD PRIMARY KEY (id)`);

      await queryRunner.query(
        `ALTER TABLE sessions DROP COLUMN IF EXISTS user_id`,
      );
      await queryRunner.query(
        `ALTER TABLE sessions RENAME COLUMN user_id_new TO user_id`,
      );
      await queryRunner.query(
        `ALTER TABLE sessions ALTER COLUMN user_id SET NOT NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE sessions ADD CONSTRAINT fk_sessions_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`,
      );

      await queryRunner.query(
        `ALTER TABLE password_reset_tokens DROP COLUMN IF EXISTS user_id`,
      );
      await queryRunner.query(
        `ALTER TABLE password_reset_tokens RENAME COLUMN user_id_new TO user_id`,
      );
      await queryRunner.query(
        `ALTER TABLE password_reset_tokens ALTER COLUMN user_id SET NOT NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE password_reset_tokens ADD CONSTRAINT fk_password_reset_tokens_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE sessions DROP COLUMN IF EXISTS refresh_token`,
    );
    await queryRunner.query(
      `ALTER TABLE sessions ALTER COLUMN refresh_token_hash SET NOT NULL`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'uq_sessions_refresh_token_hash'
        ) THEN
          EXECUTE 'ALTER TABLE sessions ADD CONSTRAINT uq_sessions_refresh_token_hash UNIQUE (refresh_token_hash)';
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'sessions'
            AND column_name = 'user_agent'
        ) THEN
          EXECUTE 'ALTER TABLE sessions ALTER COLUMN user_agent TYPE TEXT';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'sessions'
            AND column_name = 'ip_address'
        ) THEN
          EXECUTE 'ALTER TABLE sessions ALTER COLUMN ip_address TYPE inet USING NULLIF(ip_address, '''')::inet';
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE users DROP COLUMN IF EXISTS password_hash`,
    );
    await queryRunner.query(
      `ALTER TABLE users DROP COLUMN IF EXISTS google_id`,
    );
    await queryRunner.query(
      `ALTER TABLE users DROP COLUMN IF EXISTS auth_provider`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_schema = 'public'
            AND tc.table_name = 'auth_accounts'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = 'user_id'
        ) THEN
          EXECUTE 'ALTER TABLE auth_accounts ADD CONSTRAINT fk_auth_accounts_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE';
        END IF;
      END $$;
    `);
  }

  public async down(): Promise<void> {
    throw new Error('Down migration not supported for auth_accounts refactor.');
  }
}
