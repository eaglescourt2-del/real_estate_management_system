import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const user = request.user;
    const ipAddress = request.ip || request.headers['x-forwarded-for'] || request.socket.remoteAddress;
    const userAgent = request.headers['user-agent'] || 'Unknown';

    // Only audit mutating methods (POST, PUT, PATCH, DELETE) automatically
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    return next.handle().pipe(
      tap(async (responseBody) => {
        if (!isMutation) return;

        // Skip auth/login and health from spamming the entity audit log, but record user login specifically
        let action: AuditAction = AuditAction.UPDATE;
        if (method === 'POST') action = AuditAction.CREATE;
        if (method === 'DELETE') action = AuditAction.DELETE_ATTEMPT;

        const entityName = this.extractEntityName(url);
        const entityId = responseBody?.id || responseBody?.data?.id || 'GLOBAL';

        try {
          await this.prisma.auditLog.create({
            data: {
              userId: user?.id || null,
              action,
              entityName,
              entityId: String(entityId),
              newValues: responseBody ? JSON.parse(JSON.stringify(responseBody)) : null,
              ipAddress: String(ipAddress),
              userAgent: String(userAgent),
            },
          });
        } catch (err) {
          this.logger.warn(`Failed to asynchronously write audit log: ${err.message}`);
        }
      }),
    );
  }

  private extractEntityName(url: string): string {
    const cleanUrl = url.split('?')[0].replace('/api/', '');
    const parts = cleanUrl.split('/');
    return parts[0] ? parts[0].toUpperCase() : 'UNKNOWN';
  }
}

