import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { AuthProvider } from '@common/enums';
import { User } from './user.entity';

@Entity('auth_accounts')
@Index(['provider', 'providerUserId'], { unique: true })
@Index(['provider', 'email'], { unique: true })
@Check(`"provider" IN ('LOCAL','GOOGLE')`)
@Check(
  `("provider" = 'LOCAL' AND "password_hash" IS NOT NULL) OR ("provider" <> 'LOCAL')`,
)
@Check(
  `("provider" <> 'LOCAL' AND "provider_user_id" IS NOT NULL) OR ("provider" = 'LOCAL')`,
)
export class AuthAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.authAccounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20 })
  provider: AuthProvider;

  @Column({
    name: 'provider_user_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  providerUserId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
