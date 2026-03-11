import { Controller, Get, Patch, Body, UseGuards, UseInterceptors, UploadedFile, Param, Headers } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

import { UsersService } from './users.service';
import { UpdateUserDto } from './dto';
import { JwtAuthGuard, CurrentUserId } from '@auth';

import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { avatarUploadOptions } from './avatar-upload.config';

@ApiTags('User')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) { }

  // Profile
  @Get('profile')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async getProfile(
    @CurrentUserId() userId: string,
    @Headers('authorization') authorization: string
  ) {
    // console.log('User ID from JWT:', userId);

    const user = await this.usersService.getStudentProfile(userId);

    return user;
  }

  @Get('student/completeCourse')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all completed courses for a student' })
  async getAllStudentCompleteCourse(@CurrentUserId() userId: string) {
    const user = await this.usersService.getAllCompleteCourse(userId);
    return user;
  }

  @Patch('profile')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, description: 'User profile updated successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async updateProfile(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(userId, dto);
  }

  // Avatar Upload
  @Get('avatar-options')
  @ApiOperation({ summary: 'Get available avatar options' })
  @ApiResponse({ status: 200, description: 'Avatar options retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async getAvatarOptions() {
    return this.usersService.getAvatarOptions();
  }

  @Patch('avatar')
  @ApiOperation({ summary: 'Upload or update user avatar' })
  @ApiResponse({ status: 200, description: 'Avatar uploaded successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', avatarUploadOptions))
  async uploadAvatar(
    @CurrentUserId() userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.uploadAvatar(userId, file);
  }

  @Get('avatar/:id')
  @ApiOperation({ summary: 'Get user avatar by ID' })
  @ApiResponse({ status: 200, description: 'User avatar retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async getAvatar(@Param('id') id: string) {
    const presign = await this.usersService.getAvatarPresignedUrl(id);
    return { success: true, avatar_url: presign };
  }
}