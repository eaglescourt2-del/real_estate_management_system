import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterStaffDto } from './dto/register-staff.dto';
import { AuditAction, UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto, ipAddress: string, userAgent: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email address or password.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(`Account is currently ${user.status.toLowerCase()}. Access denied.`);
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, loginDto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email address or password.');
    }

    // Update last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Record login audit log
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.USER_LOGIN,
        entityName: 'USER',
        entityId: user.id,
        newValues: { email: user.email, role: user.role },
        ipAddress,
        userAgent,
      },
    });

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET', 'super_secret_ghana_real_estate_jwt_key_2026_x89a'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1d'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'super_secret_ghana_refresh_key_2026_z12b'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    return {
      message: 'Login successful.',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        telephone: user.telephone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
      },
    };
  }

  async registerStaff(dto: RegisterStaffDto, creatorId?: string) {
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existingEmail) {
      throw new ConflictException(`Staff user with email '${dto.email}' already exists.`);
    }

    const existingPhone = await this.prisma.user.findUnique({
      where: { telephone: dto.telephone.trim() },
    });

    if (existingPhone) {
      throw new ConflictException(`Staff user with telephone '${dto.telephone}' already exists.`);
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        telephone: dto.telephone.trim(),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        passwordHash,
        role: dto.role,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        telephone: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      message: `Staff member ${user.firstName} ${user.lastName} successfully registered with role ${user.role}.`,
      user,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        telephone: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User profile not found.');
    }

    return user;
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'super_secret_ghana_refresh_key_2026_z12b'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Invalid or expired refresh token.');
      }

      const newPayload = { sub: user.id, email: user.email, role: user.role };
      const newAccessToken = this.jwtService.sign(newPayload, {
        secret: this.configService.get<string>('JWT_SECRET', 'super_secret_ghana_real_estate_jwt_key_2026_x89a'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1d'),
      });

      return { accessToken: newAccessToken };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  async listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        telephone: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User profile not found.');
    }

    const isCurrentValid = await argon2.verify(user.passwordHash, currentPassword);
    if (!isCurrentValid) {
      throw new BadRequestException('Incorrect current password.');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException('New password cannot be the same as your current password.');
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.UPDATE,
        entityName: 'USER_PASSWORD',
        entityId: user.id,
        newValues: { message: 'User self-changed password' },
      },
    });

    return { message: 'Password updated successfully. Please use your new password for future logins.' };
  }

  async updateUserStatus(targetUserId: string, status: UserStatus, adminUserId: string) {
    if (targetUserId === adminUserId) {
      throw new BadRequestException('You cannot modify your own administrative account status.');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new BadRequestException('Target staff member not found.');
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { status },
      select: {
        id: true,
        email: true,
        telephone: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: AuditAction.UPDATE,
        entityName: 'USER_STATUS',
        entityId: targetUserId,
        oldValues: { status: targetUser.status },
        newValues: { status },
      },
    });

    return {
      message: `Staff member ${updated.firstName} ${updated.lastName} status changed to ${status}.`,
      user: updated,
    };
  }

  async resetUserPassword(targetUserId: string, newPassword: string, adminUserId: string) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new BadRequestException('Target staff member not found.');
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: AuditAction.UPDATE,
        entityName: 'USER_PASSWORD_RESET',
        entityId: targetUserId,
        newValues: { resetBy: adminUserId },
      },
    });

    return {
      message: `Temporary password set successfully for ${targetUser.firstName} ${targetUser.lastName}.`,
    };
  }

  async deleteUser(targetUserId: string, adminUserId: string) {
    if (targetUserId === adminUserId) {
      throw new BadRequestException('You cannot delete your own administrative account.');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new BadRequestException('Staff member not found.');
    }

    // Safely reassign any operational & audit foreign keys to the deleting Super Admin
    await this.prisma.$transaction([
      this.prisma.customer.updateMany({
        where: { assignedAgentId: targetUserId },
        data: { assignedAgentId: adminUserId },
      }),
      this.prisma.customer.updateMany({
        where: { createdById: targetUserId },
        data: { createdById: adminUserId },
      }),
      this.prisma.plotAllocation.updateMany({
        where: { salesAgentId: targetUserId },
        data: { salesAgentId: adminUserId },
      }),
      this.prisma.customerPayment.updateMany({
        where: { recordedByUserId: targetUserId },
        data: { recordedByUserId: adminUserId },
      }),
      this.prisma.customerPayment.updateMany({
        where: { verifiedByUserId: targetUserId },
        data: { verifiedByUserId: adminUserId },
      }),
      this.prisma.expense.updateMany({
        where: { recordedByUserId: targetUserId },
        data: { recordedByUserId: adminUserId },
      }),
      this.prisma.expense.updateMany({
        where: { approvedByUserId: targetUserId },
        data: { approvedByUserId: adminUserId },
      }),
      this.prisma.refundRequest.updateMany({
        where: { requestedByUserId: targetUserId },
        data: { requestedByUserId: adminUserId },
      }),
      this.prisma.refundRequest.updateMany({
        where: { reviewedByUserId: targetUserId },
        data: { reviewedByUserId: adminUserId },
      }),
      this.prisma.refundRequest.updateMany({
        where: { approvedByUserId: targetUserId },
        data: { approvedByUserId: adminUserId },
      }),
      this.prisma.landownerPayment.updateMany({
        where: { recordedByUserId: targetUserId },
        data: { recordedByUserId: adminUserId },
      }),
      this.prisma.auditLog.updateMany({
        where: { userId: targetUserId },
        data: { userId: null },
      }),
      this.prisma.user.delete({
        where: { id: targetUserId },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: adminUserId,
          action: AuditAction.DELETE_ATTEMPT,
          entityName: 'USER',
          entityId: targetUserId,
          oldValues: {
            email: targetUser.email,
            role: targetUser.role,
            name: `${targetUser.firstName} ${targetUser.lastName}`,
          },
          newValues: { message: 'Staff member account permanently deleted and records reassigned to admin.' },
        },
      }),
    ]);

    return {
      message: `Staff member ${targetUser.firstName} ${targetUser.lastName} (${targetUser.email}) has been permanently deleted.`,
    };
  }
}

