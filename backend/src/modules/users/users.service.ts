import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(roleFilter?: UserRole, statusFilter?: UserStatus) {
    const whereClause: any = {};
    if (roleFilter) whereClause.role = roleFilter;
    if (statusFilter) whereClause.status = statusFilter;

    return this.prisma.user.findMany({
      where: whereClause,
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
        _count: {
          select: {
            assignedCustomers: true,
            plotAllocations: true,
            recordedPayments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
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
    });

    if (!user) {
      throw new NotFoundException(`Staff user with ID '${id}' not found.`);
    }

    return user;
  }

  async updateStatus(id: string, newStatus: UserStatus, currentUserId: string) {
    if (id === currentUserId && newStatus !== UserStatus.ACTIVE) {
      throw new BadRequestException('You cannot suspend or deactivate your own account.');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { status: newStatus },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
    });

    return {
      message: `Staff member ${user.firstName} ${user.lastName}'s status updated to ${newStatus}.`,
      user,
    };
  }

  async updateRole(id: string, newRole: UserRole, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException('You cannot alter your own administrative role.');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
    });

    return {
      message: `Staff member ${user.firstName} ${user.lastName}'s role updated to ${newRole}.`,
      user,
    };
  }
}
