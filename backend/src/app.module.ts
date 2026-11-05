import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { LandInventoryModule } from './modules/land-inventory/land-inventory.module';
import { CrmModule } from './modules/crm/crm.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { LandownersRefundsModule } from './modules/landowners-and-refunds/landowners-refunds.module';
import { FinancialsModule } from './modules/financials/financials.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    SettingsModule,
    AuditLogsModule,
    UploadsModule,
    LandInventoryModule,
    CrmModule,
    PaymentsModule,
    LandownersRefundsModule,
    FinancialsModule,
    NotificationsModule,
    DashboardModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
