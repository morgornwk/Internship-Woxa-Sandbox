import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminInvitationsService } from './admin-invitations.service';
import { AdminInvitationsController } from './admin-invitations.controller';
import { AdminInvitation } from './entities/admin-invitation.entity';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminInvitation], 'auth'),
    UsersModule,
    AuthModule,
  ],
  controllers: [AdminInvitationsController],
  providers: [AdminInvitationsService],
  exports: [AdminInvitationsService],
})
export class AdminInvitationsModule {}
