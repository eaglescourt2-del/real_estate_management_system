import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('RolesGuard (RBAC 4-Role Verification)', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockContext = (role?: UserRole): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: role ? { id: 'u1', role } : undefined,
        }),
      }),
    } as any;
  };

  it('should allow access if no roles are explicitly required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext(UserRole.SALES_AGENT);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should grant SUPER_ADMINISTRATOR universal access regardless of route role requirement', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.MANAGING_DIRECTOR]);
    const context = createMockContext(UserRole.SUPER_ADMINISTRATOR);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow role when user has exact matching role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.MANAGING_DIRECTOR]);
    const context = createMockContext(UserRole.MANAGING_DIRECTOR);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when SALES_AGENT tries to access Director-only route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.MANAGING_DIRECTOR]);
    const context = createMockContext(UserRole.SALES_AGENT);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when ADMINISTRATOR tries to access Super Admin-only route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.SUPER_ADMINISTRATOR]);
    const context = createMockContext(UserRole.ADMINISTRATOR);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

