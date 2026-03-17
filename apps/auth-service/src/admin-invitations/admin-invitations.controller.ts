import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminInvitationsService } from './admin-invitations.service';
import { InviteAdminDto } from './dto/invite-admin.dto';
import { AcceptAdminInviteDto } from './dto/accept-admin-invite.dto';
import {
  SuspendUserResponseDto,
  DeleteUserResponseDto,
  CancelInvitationResponseDto,
  UnsuspendUserResponseDto,
} from './dto/admin-management-response.dto';
import { AdminListDto } from './dto/admin-list.dto';
import { UserRole } from '@common/enums';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import { CurrentUserId } from '@auth';

@ApiTags('Admin Invitations')
@Controller('admin-invitations')
export class AdminInvitationsController {
  constructor(
    private readonly adminInvitationsService: AdminInvitationsService,
  ) {}

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @Post('invite')
  @ApiOperation({ summary: 'Invite admin (OWNER only)' })
  @ApiResponse({ status: 201, description: 'Admin invited.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. OWNER role required.' })
  @ApiResponse({
    status: 409,
    description: 'Conflict. Email already exists or admin already active.',
  })
  async inviteAdmin(
    @CurrentUserId() invitedByUserId: string,
    @Body() dto: InviteAdminDto,
  ) {
    return this.adminInvitationsService.inviteAdmin({
      invitedByUserId,
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @Patch(':userId/resend')
  @ApiOperation({ summary: 'Resend invite email (OWNER only)' })
  @ApiResponse({ status: 200, description: 'Invite resent.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. OWNER role required.' })
  @ApiResponse({ status: 404, description: 'User not found or not admin.' })
  async resendInvite(
    @CurrentUserId() invitedByUserId: string,
    @Param('userId') userId: string,
  ) {
    return this.adminInvitationsService.resendInvite(userId, invitedByUserId);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @Get('admins')
  @ApiOperation({ summary: 'List admins with status (OWNER only)' })
  @ApiResponse({
    status: 200,
    description: 'Admins list retrieved.',
    type: [AdminListDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. OWNER role required.' })
  async listAdmins(): Promise<AdminListDto[]> {
    return this.adminInvitationsService.listAdmins();
  }

  @Post('accept')
  @ApiOperation({ summary: 'Accept admin invitation' })
  @ApiResponse({ status: 200, description: 'Invitation accepted.' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request. Invalid token or password.',
  })
  @ApiResponse({ status: 404, description: 'Invitation not found or expired.' })
  async acceptInvite(@Body() dto: AcceptAdminInviteDto) {
    return this.adminInvitationsService.acceptInvite(
      dto.token,
      dto.newPassword,
    );
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @Patch(':userId/suspend')
  @ApiOperation({ summary: 'Suspend admin user (OWNER only)' })
  @ApiResponse({
    status: 200,
    description: 'Admin suspended.',
    type: SuspendUserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Owner role required.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @Roles(UserRole.OWNER)
  async suspendUser(
    @Param('userId') userId: string,
  ): Promise<SuspendUserResponseDto> {
    return this.adminInvitationsService.suspendUser(userId);
  }

  @Patch(':userId/unsuspend')
  @ApiOperation({ summary: 'Unsuspend admin user (OWNER only)' })
  @ApiResponse({
    status: 200,
    description: 'Admin unsuspended.',
    type: UnsuspendUserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Owner role required.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @Roles(UserRole.OWNER)
  async unsuspendUser(
    @Param('userId') userId: string,
  ): Promise<UnsuspendUserResponseDto> {
    return this.adminInvitationsService.unsuspendUser(userId);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @Delete(':userId')
  @ApiOperation({ summary: 'Delete admin user (OWNER only)' })
  @ApiResponse({
    status: 200,
    description: 'Admin deleted.',
    type: DeleteUserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. OWNER role required.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async deleteUser(
    @Param('userId') userId: string,
  ): Promise<DeleteUserResponseDto> {
    return this.adminInvitationsService.deleteUser(userId);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @Delete(':userId/invitation')
  @ApiOperation({ summary: 'Delete pending invitation email (OWNER only)' })
  @ApiResponse({
    status: 200,
    description: 'Invitation deleted.',
    type: CancelInvitationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. OWNER role required.' })
  @ApiResponse({ status: 404, description: 'No pending invitation found.' })
  async cancelInvitationEmail(
    @Param('userId') userId: string,
  ): Promise<CancelInvitationResponseDto> {
    return this.adminInvitationsService.cancelInvitationEmail(userId);
  }
}
