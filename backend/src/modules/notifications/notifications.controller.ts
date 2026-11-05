import {
  Body,
  Controller,
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
import { UserRole } from '@prisma/client';
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
