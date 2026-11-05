import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

describe('AuthService (Stage 2 Verification)', () => {
  let service: AuthService;
  let prismaService: any;
  let jwtService: any;
  let configService: any;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'superadmin@realestatedev.gh',
    telephone: '+233244000001',
    passwordHash: '',
    firstName: 'Chief',
    lastName: 'Admin',
    role: UserRole.SUPER_ADMINISTRATOR,
    status: UserStatus.ACTIVE,
  };

  beforeAll(async () => {
    mockUser.passwordHash = await argon2.hash('SuperAdminPassword2026!', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  });

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mocked.jwt.token'),
      verify: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string, defaultVal: string) => defaultVal),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should successfully authenticate with valid credentials and return JWT tokens', async () => {
    prismaService.user.findUnique.mockResolvedValue(mockUser);
    prismaService.user.update.mockResolvedValue(mockUser);
    prismaService.auditLog.create.mockResolvedValue({ id: 'log-1' });

    const result = await service.login(
      { email: 'superadmin@realestatedev.gh', password: 'SuperAdminPassword2026!' },
      '127.0.0.1',
      'Jest-Test-Agent',
    );

    expect(result).toHaveProperty('accessToken', 'mocked.jwt.token');
    expect(result).toHaveProperty('refreshToken', 'mocked.jwt.token');
    expect(result.user.role).toEqual(UserRole.SUPER_ADMINISTRATOR);
    expect(prismaService.auditLog.create).toHaveBeenCalled();
  });

  it('should reject authentication if password is invalid', async () => {
    prismaService.user.findUnique.mockResolvedValue(mockUser);

    await expect(
      service.login(
        { email: 'superadmin@realestatedev.gh', password: 'WrongPassword123!' },
        '127.0.0.1',
        'Jest-Test-Agent',
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject authentication if user account is suspended', async () => {
    prismaService.user.findUnique.mockResolvedValue({
      ...mockUser,
      status: UserStatus.SUSPENDED,
    });

    await expect(
      service.login(
        { email: 'superadmin@realestatedev.gh', password: 'SuperAdminPassword2026!' },
        '127.0.0.1',
        'Jest-Test-Agent',
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject registration if email is already in use', async () => {
    prismaService.user.findUnique.mockResolvedValueOnce(mockUser);

    await expect(
      service.registerStaff({
        email: 'superadmin@realestatedev.gh',
        telephone: '+233244999999',
        firstName: 'New',
        lastName: 'Agent',
        password: 'Password123!',
        role: UserRole.SALES_AGENT,
      }),
    ).rejects.toThrow(ConflictException);
  });
});

