import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterStaffDto } from './dto/register-staff.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetStaffPasswordDto } from './dto/reset-staff-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, UserStatus } from '@prisma/client';

@ApiTags('Authentication & Access Control')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate staff member and receive JWT tokens' })
  @ApiResponse({ status: 200, description: 'Authentication successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or inactive account' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Retrieve currently authenticated staff profile' })
  async getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  @Post('register-staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMINISTRATOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Register a new staff member (Super Administrator only)' })
  @ApiResponse({ status: 201, description: 'Staff member registered successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden. Super Administrator role required.' })
  async registerStaff(
    @Body() dto: RegisterStaffDto,
    @CurrentUser('id') creatorId: string,
  ) {
    return this.authService.registerStaff(dto, creatorId);
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh expired access token with valid refresh token' })
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMINISTRATOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List all staff users (Super Administrator only)' })
  async listUsers() {
    return this.authService.listUsers();
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Change current user password' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto.currentPassword, dto.newPassword);
  }

  @Put('users/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMINISTRATOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update staff member active/suspended status (Super Admin only)' })
  async updateUserStatus(
    @Param('id') targetUserId: string,
    @Body('status') status: UserStatus,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.authService.updateUserStatus(targetUserId, status, adminUserId);
  }

  @Put('users/:id/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMINISTRATOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Reset a staff member password (Super Admin only)' })
  async resetUserPassword(
    @Param('id') targetUserId: string,
    @Body() dto: ResetStaffPasswordDto,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.authService.resetUserPassword(targetUserId, dto.newPassword, adminUserId);
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMINISTRATOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a staff account permanently (Super Admin only)' })
  async deleteUser(
    @Param('id') targetUserId: string,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.authService.deleteUser(targetUserId, adminUserId);
  }
}

