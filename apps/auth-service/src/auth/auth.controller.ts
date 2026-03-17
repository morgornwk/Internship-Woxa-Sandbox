import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';

import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  VerifyOtpDto,
  ResetPasswordDto,
} from './dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard, CurrentUser } from '@auth';

@ApiTags('Authentication')
@ApiBearerAuth('access-token')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  // ===================== Register =====================
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 409, description: 'Email already exists.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // ===================== Login =====================
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // ===================== Google OAuth Redirect =====================
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Login with Google (OAuth 2.0)',
    description: `เปลี่ยนเส้นทางผู้ใช้ไปที่ Google เพื่อทำการยืนยันตัวตน จุดเชื่อมต่อนี้จะไม่ส่งคืน Token ใด ๆ โดยตรง แต่จะเปลี่ยนเส้นทางผู้ใช้ไปที่หน้าการยืนยันตัวตนของ Google`,
  })
  @ApiResponse({
    status: 302,
    description: 'Redirect to Google OAuth consent screen',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async googleAuth() {
    // redirect ไปที่ Google
  }

  // ===================== Google OAuth Callback =====================
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({
    status: 302,
    description: 'Redirect to frontend after successful authentication',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async googleCallback(
    @CurrentUser() googleProfile: any,
    @Res() res: Response,
  ) {
    const result = await this.authService.googleLogin(googleProfile);

    const frontend = process.env.FRONTEND_URL;
    const accessToken = encodeURIComponent(result.tokens.accessToken);

    // redirect กลับไปที่ frontend พร้อมกับ accessToken ใน query string
    return res.redirect(
      `${frontend}/google-callback?accessToken=${accessToken}`,
    );
  }

  // ===================== Refresh Token =====================
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token (JWT only)' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid or expired refresh token)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (refresh token revoked)',
  })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  // ===================== Logout =====================
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout (revoke refresh token)' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Logged out successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid access token)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (refresh token already revoked)',
  })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async logout(
    @CurrentUser('userId') userId: string,
    @Body() dto: RefreshTokenDto,
  ) {
    await this.authService.logout(userId, dto.refreshToken);

    return { message: 'Logged out successfully' };
  }

  // ===================== Logout All =====================
  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'Logged out from all devices successfully.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid access token)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (refresh tokens already revoked)',
  })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  @ApiOperation({ summary: 'Logout from all devices' })
  async logoutAll(@CurrentUser('userId') userId: string) {
    await this.authService.logoutAll(userId);

    return { message: 'Logged out from all devices successfully' };
  }

  // ===================== Forgot Password =====================
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({
    status: 200,
    description:
      'If the email is registered, a password reset link has been sent.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Email not found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  @Throttle({ short: { ttl: 60, limit: 2 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  // ===================== Verify OTP =====================
  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP for password reset' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Email not found or OTP expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.email, dto.otp);
  }

  // ===================== Reset Password =====================
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using reset token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({
    status: 404,
    description: 'Reset token not found or expired.',
  })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.resetToken, dto.newPassword);
  }
}
