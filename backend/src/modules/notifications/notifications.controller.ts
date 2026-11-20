import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationChannel, NotificationStatus, UserRole } from '@prisma/client';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';
import { WhatsAppService } from './channels/whatsapp.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import {
  UpdateNotificationTemplateDto,
  WhatsAppWebhookVerifyDto,
} from './dto/whatsapp-webhook.dto';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly whatsappService: WhatsAppService,
  ) {}

  // =========================================================================
  // PUBLIC WEBHOOK ENDPOINTS (WhatsApp Cloud API integration)
  // =========================================================================

  @Get('webhook/whatsapp')
  @ApiOperation({ summary: 'WhatsApp Cloud API Webhook verification challenge' })
  verifyWhatsAppWebhook(@Query() query: WhatsAppWebhookVerifyDto, @Res() res: Response) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    const verifiedChallenge = this.whatsappService.verifyWebhook(mode, token, challenge);
    if (verifiedChallenge) {
      return res.status(HttpStatus.OK).send(verifiedChallenge);
    }
    return res.status(HttpStatus.FORBIDDEN).send('Webhook verification failed');
  }

  @Post('webhook/whatsapp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WhatsApp Cloud API delivery status callback' })
  async handleWhatsAppWebhook(@Body() payload: any) {
    await this.notificationsService.handleWhatsAppWebhookStatuses(payload);
    return { status: 'EVENT_RECEIVED' };
  }

  // =========================================================================
  // PROTECTED OPERATIONAL ENDPOINTS
  // =========================================================================

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMINISTRATOR,
    UserRole.MANAGING_DIRECTOR,
    UserRole.ADMINISTRATOR,
    UserRole.SALES_AGENT,
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Query notification logs and delivery audit trail' })
  async getNotifications(@Query() query: QueryNotificationsDto) {
    return this.notificationsService.queryNotifications(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMINISTRATOR,
    UserRole.MANAGING_DIRECTOR,
    UserRole.ADMINISTRATOR,
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dispatch or enqueue a notification to customer' })
  async createNotification(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.sendNotification(dto);
  }

  @Post('process-queue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMINISTRATOR,
    UserRole.MANAGING_DIRECTOR,
    UserRole.ADMINISTRATOR,
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger worker processing of queued notifications' })
  async processQueue(@Query('batchSize') batchSize?: number) {
    return this.notificationsService.processQueuedNotifications(batchSize ? Number(batchSize) : 25);
  }

  @Post(':id/retry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMINISTRATOR,
    UserRole.MANAGING_DIRECTOR,
    UserRole.ADMINISTRATOR,
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually retry a failed notification transmission' })
  async retryNotification(@Param('id') id: string) {
    return this.notificationsService.retryNotification(id);
  }

  @Put(':id/mark-delivered')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMINISTRATOR,
    UserRole.MANAGING_DIRECTOR,
    UserRole.ADMINISTRATOR,
    UserRole.SALES_AGENT,
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually mark notification status as DELIVERED' })
  async markDelivered(@Param('id') id: string) {
    return this.notificationsService.markDelivered(id);
  }

  @Delete('clear')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMINISTRATOR,
    UserRole.MANAGING_DIRECTOR,
    UserRole.ADMINISTRATOR,
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clear notification message list' })
  async clearNotifications(
    @Query('channel') channel?: NotificationChannel,
    @Query('status') status?: NotificationStatus,
    @Body() body?: { ids?: string[] },
  ) {
    return this.notificationsService.clearNotifications({
      channel,
      status,
      ids: body?.ids,
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMINISTRATOR,
    UserRole.MANAGING_DIRECTOR,
    UserRole.ADMINISTRATOR,
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a single notification message log' })
  async deleteNotification(@Param('id') id: string) {
    return this.notificationsService.deleteNotification(id);
  }

  @Get('reminders-preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMINISTRATOR,
    UserRole.MANAGING_DIRECTOR,
    UserRole.ADMINISTRATOR,
    UserRole.SALES_AGENT,
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Preview customers with due payment instalments' })
  async getRemindersPreview() {
    return this.notificationsService.getPaymentDueRemindersPreview();
  }

  @Post('send-monthly-reminders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMINISTRATOR,
    UserRole.MANAGING_DIRECTOR,
    UserRole.ADMINISTRATOR,
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Broadcast automated monthly payment due reminders via WhatsApp & Email' })
  async sendMonthlyReminders(@Body() body: { allocationIds?: string[] }) {
    return this.notificationsService.broadcastPaymentDueReminders(body?.allocationIds);
  }

  @Post('send-promo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMINISTRATOR,
    UserRole.MANAGING_DIRECTOR,
    UserRole.ADMINISTRATOR,
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Broadcast promotional campaign & site announcements to clients' })
  async sendPromo(
    @Body()
    dto: {
      title: string;
      message: string;
      location?: string;
      offer?: string;
      channel?: 'ALL' | 'WHATSAPP' | 'EMAIL';
      customerIds?: string[];
    },
  ) {
    return this.notificationsService.broadcastPromo(dto);
  }

  @Post('send-document-ready')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMINISTRATOR,
    UserRole.MANAGING_DIRECTOR,
    UserRole.ADMINISTRATOR,
    UserRole.SALES_AGENT,
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send official notice that documents are ready for collection' })
  async sendDocumentReady(
    @Body()
    dto: {
      customerId: string;
      allocationId?: string;
      documentType?: string;
      collectionOffice?: string;
      officeHours?: string;
    },
  ) {
    return this.notificationsService.triggerDocumentReady(dto);
  }

  @Get('templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMINISTRATOR,
    UserRole.MANAGING_DIRECTOR,
    UserRole.ADMINISTRATOR,
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List notification templates for WhatsApp and Email' })
  async getTemplates() {
    return this.notificationsService.getTemplates();
  }

  @Put('templates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.MANAGING_DIRECTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update notification template body (Super Admin / MD only)' })
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateNotificationTemplateDto,
  ) {
    return this.notificationsService.updateTemplate(id, dto);
  }
}
