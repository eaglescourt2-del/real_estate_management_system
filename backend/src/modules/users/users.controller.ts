import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, UserStatus } from '@prisma/client';

@ApiTags('Staff & User Management')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.MANAGING_DIRECTOR)
  @ApiOperation({ summary: 'List all company staff members (Super Admin & MD only)' })
  @ApiQuery({ name: 'role', enum: UserRole, required: false })
  @ApiQuery({ name: 'status', enum: UserStatus, required: false })
  async findAll(
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
  ) {
    return this.usersService.findAll(role, status);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.MANAGING_DIRECTOR)
  @ApiOperation({ summary: 'Retrieve specific staff member details' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMINISTRATOR)
  @ApiOperation({ summary: 'Activate or suspend staff member (Super Admin only)' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: UserStatus,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.usersService.updateStatus(id, status, currentUserId);
  }

  @Patch(':id/role')
  @Roles(UserRole.SUPER_ADMINISTRATOR)
  @ApiOperation({ summary: 'Change staff member role (Super Admin only)' })
  async updateRole(
    @Param('id') id: string,
    @Body('role') role: UserRole,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.usersService.updateRole(id, role, currentUserId);
  }
}
